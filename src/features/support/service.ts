// Node-only service, shared by server boundaries and isolated PostgreSQL tests.
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import {
  supportCases as cases,
  supportCaseEvents as events,
  userAccess,
  supportReviewers,
  supportCaseBookings,
} from "@/lib/db/schema";
import { isLoopbackOrigin } from "@/lib/local-mode";
import { AccessError, requireIdentity } from "@/lib/permissions/access";
import { recheckIdentity } from "@/lib/permissions/recheck";
import { RuleError } from "@/lib/rule-error";
import { caseInput, pageInput, statusInput, transitions } from "./input";
import {
  queryBookingForReport,
  queryCaseBooking,
} from "@/features/support-bookings/query";

export type CaseScope = "requester" | "reviewer";
type Database = AuthRuntime["db"];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function actor(
  runtime: AuthRuntime,
  headers: Headers,
  scope: CaseScope = "requester",
) {
  if (
    !["development", "test"].includes(runtime.environment) ||
    !isLoopbackOrigin(runtime.origin)
  )
    throw new AccessError(503);
  const identity = await requireIdentity(runtime, headers);
  if (scope === "reviewer") {
    if (!identity.roles.includes("admin")) throw new AccessError(403);
    const [capability] = await runtime.db
      .select({ id: supportReviewers.userId })
      .from(supportReviewers)
      .where(
        and(
          eq(supportReviewers.userId, identity.userId),
          eq(supportReviewers.source, "local_fixture"),
          eq(supportReviewers.status, "authorized"),
        ),
      );
    if (!capability) throw new AccessError(403);
  }
  return identity;
}
function activeAccount(userId: string) {
  return sql`EXISTS (SELECT 1 FROM "user" u JOIN user_access a ON a.user_id = u.id WHERE u.id = ${userId} AND u.email_verified = true AND u.email LIKE ${"%.test"} AND a.status = 'active')`;
}
function caseAccess(userId: string, scope: CaseScope): SQL {
  return and(
    eq(cases.source, "local_synthetic"),
    activeAccount(userId),
    scope === "requester"
      ? eq(cases.requesterUserId, userId)
      : sql`${cases.requesterUserId} <> ${userId} AND EXISTS (
       SELECT 1 FROM support_case_assignments a JOIN support_reviewers r ON r.user_id = a.reviewer_user_id JOIN user_roles g ON g.user_id = r.user_id
       WHERE a.case_id = ${cases.id} AND a.reviewer_user_id = ${userId} AND r.source = 'local_fixture' AND r.status = 'authorized' AND g.role = 'admin')`,
  ) as SQL;
}
const summary = {
  id: cases.id,
  category: cases.category,
  subject: cases.subject,
  status: cases.status,
  revision: cases.revision,
  createdAt: cases.createdAt,
  updatedAt: cases.updatedAt,
};
async function selectCase(
  tx: Transaction,
  userId: string,
  caseId: string,
  scope: CaseScope,
  lock: "share" | "update",
) {
  if (!z.uuid().safeParse(caseId).success) throw new AccessError(404);
  const [row] = await tx
    .select({ ...summary, body: cases.body })
    .from(cases)
    .where(and(eq(cases.id, caseId), caseAccess(userId, scope)))
    .for(lock);
  if (!row) throw new AccessError(404);
  return row;
}

export async function listCases(
  runtime: AuthRuntime,
  headers: Headers,
  scope: CaseScope,
  input: unknown = 1,
) {
  const identity = await actor(runtime, headers, scope);
  const page = pageInput.parse(input);
  const rows = await runtime.db
    .select(summary)
    .from(cases)
    .where(caseAccess(identity.userId, scope))
    .orderBy(desc(cases.createdAt), desc(cases.id))
    .limit(21)
    .offset((page - 1) * 20);
  return {
    cases: rows.slice(0, 20),
    page,
    hasMore: rows.length > 20 && page < 1000,
  };
}

export async function readCase(
  runtime: AuthRuntime,
  headers: Headers,
  caseId: string,
  scope: CaseScope,
) {
  const identity = await actor(runtime, headers, scope);
  return runtime.db.transaction(async (tx) => {
    await selectCase(tx, identity.userId, caseId, scope, "share");
    await recheckIdentity(
      tx,
      identity,
      scope === "reviewer" ? "admin" : undefined,
    );
    const row = await selectCase(tx, identity.userId, caseId, scope, "share");
    // Return no requester/reviewer identity, report body copy, or internal notes in audit history.
    const history = await tx
      .select({
        action: events.action,
        previousStatus: events.previousStatus,
        nextStatus: events.nextStatus,
        revision: events.revision,
        createdAt: events.createdAt,
      })
      .from(events)
      .where(eq(events.caseId, row.id))
      .orderBy(events.revision);
    const booking = await queryCaseBooking(tx, identity, row.id, scope);
    return { ...row, history, ...(booking === undefined ? {} : { booking }) };
  });
}
export type CaseDetail = Awaited<ReturnType<typeof readCase>>;
export type CaseList = Awaited<ReturnType<typeof listCases>>;

export async function createCase(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown,
) {
  const identity = await actor(runtime, headers);
  const values = caseInput.parse(input);
  return runtime.db.transaction(async (tx) => {
    // Serialize account-local limits without granting writes to account status.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`support:${identity.userId}`}, 0))`,
    );
    await recheckIdentity(tx, identity);
    const [access] = await tx
      .select({ id: userAccess.userId })
      .from(userAccess)
      .where(
        and(
          eq(userAccess.userId, identity.userId),
          activeAccount(identity.userId),
        ),
      );
    if (!access) throw new AccessError(403);
    const [existing] = await tx
      .select()
      .from(cases)
      .where(
        and(
          eq(cases.requesterUserId, identity.userId),
          eq(cases.requestKey, values.requestKey),
        ),
      );
    if (existing) {
      const [association] = await tx
        .select({ bookingId: supportCaseBookings.bookingId })
        .from(supportCaseBookings)
        .where(eq(supportCaseBookings.caseId, existing.id));
      if (
        existing.category !== values.category ||
        existing.subject !== values.subject ||
        existing.body !== values.body ||
        association?.bookingId !== values.bookingId
      )
        throw new RuleError(
          409,
          "This request was already saved with different fields. Start a new report.",
        );
      if (values.bookingId)
        await queryBookingForReport(tx, identity, values.bookingId);
      return { id: existing.id };
    }
    const recent = await tx
      .select({ id: cases.id })
      .from(cases)
      .where(
        and(
          eq(cases.requesterUserId, identity.userId),
          sql`${cases.createdAt} > now() - interval '5 minutes'`,
        ),
      )
      .limit(5);
    if (recent.length >= 5)
      throw new RuleError(
        429,
        "The local report limit was reached. Wait a few minutes and try again.",
      );
    if (values.bookingId)
      await queryBookingForReport(tx, identity, values.bookingId);
    const { bookingId, ...reportValues } = values;
    const [created] = await tx
      .insert(cases)
      .values({ ...reportValues, requesterUserId: identity.userId })
      .returning({ id: cases.id });
    await tx.insert(events).values({
      caseId: created.id,
      action: "created",
      actorUserId: identity.userId,
      nextStatus: "open",
      revision: 0,
    });
    if (bookingId)
      await tx
        .insert(supportCaseBookings)
        .values({ caseId: created.id, bookingId });
    return created;
  });
}

export async function changeCaseStatus(
  runtime: AuthRuntime,
  headers: Headers,
  caseId: string,
  input: unknown,
) {
  const identity = await actor(runtime, headers, "reviewer");
  return runtime.db.transaction(async (tx) => {
    await selectCase(tx, identity.userId, caseId, "reviewer", "update");
    await recheckIdentity(tx, identity, "admin");
    const row = await selectCase(
      tx,
      identity.userId,
      caseId,
      "reviewer",
      "update",
    );
    const values = statusInput.parse(input);
    if (row.revision !== values.revision)
      throw new RuleError(
        409,
        "This case changed. Reload it before changing the status.",
      );
    if (row.status === values.status) return row;
    if (!transitions[row.status].includes(values.status))
      throw new RuleError(400, "That status change is not available.");
    const [updated] = await tx
      .update(cases)
      .set({
        status: values.status,
        revision: row.revision + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(cases.id, row.id), caseAccess(identity.userId, "reviewer")))
      .returning(summary);
    if (!updated) throw new AccessError(404);
    await tx.insert(events).values({
      caseId: row.id,
      action: "status_changed",
      actorUserId: identity.userId,
      previousStatus: row.status,
      nextStatus: updated.status,
      revision: updated.revision,
    });
    return updated;
  });
}
