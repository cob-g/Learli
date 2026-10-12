// Node-only: immutable replacement rows, current family authority, DB-time expiry.
import { randomUUID, createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import {
  bookings,
  bookingEvents,
  bookingLifecycleEvents,
} from "@/lib/db/schema";
import { AccessError } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import {
  requireBookingActor,
  reservationTransaction,
  authorizedLearner,
  eligibleContext,
  candidateIntervals,
  databaseNow,
  expireTutorReservations,
} from "./service";
import { cancelDemoInput, rescheduleDemoInput } from "./lifecycle-input";
import { bookingFingerprint } from "./request-fingerprint";
import {
  effectiveDemoState,
  type DemoLifecycleReceipt,
} from "./lifecycle-model";

type Transaction = Parameters<
  Parameters<AuthRuntime["db"]["transaction"]>[0]
>[0];
const conflict = () =>
  new RuleError(
    409,
    "This simulation changed. Reload booking details before trying again.",
  );

async function lockBooking(tx: Transaction, id: string) {
  // Same order as meeting/time-off/create. Never lock a booking before its tutor.
  await tx.execute(
    sql`SELECT tp.id FROM tutor_profiles tp JOIN bookings b ON b.tutor_id=tp.id WHERE b.id=${id}::uuid FOR UPDATE OF tp`,
  );
  const [row] = await tx
    .select()
    .from(bookings)
    .where(eq(bookings.id, id))
    .for("no key update");
  if (!row) throw new AccessError(404);
  const result = await tx.execute<{
    slug: string;
    timezone: string;
    subject: string;
  }>(
    sql`SELECT tp.slug,tp.timezone,s.slug AS subject FROM tutor_profiles tp JOIN subjects s ON s.id=${row.subjectId}::uuid WHERE tp.id=${row.tutorId}::uuid`,
  );
  if (!result.rows[0]) throw new AccessError(404);
  return { row, tutor: result.rows[0] };
}
async function currentAuthority(
  tx: Transaction,
  actor: Awaited<ReturnType<typeof requireBookingActor>>,
  row: typeof bookings.$inferSelect,
  rescheduling: boolean,
) {
  const result = await tx.execute<{ now: string }>(sql`
    SELECT clock_timestamp()::text AS now FROM "user" u
    JOIN user_access ua ON ua.user_id=u.id AND ua.status='active'
    JOIN session s ON s.user_id=u.id AND s.id=${actor.sessionId} AND s.expires_at>clock_timestamp()
    JOIN learner_profiles l ON l.id=${row.learnerId}::uuid AND l.source='local_fixture' AND l.status='active'
    WHERE u.id=${actor.userId} AND u.email_verified=true AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$'
      AND ((l.management='self' AND l.user_id=u.id AND l.level='college_support' AND EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='student')) OR
       (l.management='guardian' AND l.user_id IS NULL AND EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='parent') AND EXISTS(SELECT 1 FROM guardian_learner_links g WHERE g.guardian_user_id=u.id AND g.learner_id=l.id AND g.source='local_fixture' AND g.status='authorized')))
      ${rescheduling ? sql`AND EXISTS(SELECT 1 FROM tutor_profiles tp JOIN "user" tu ON tu.id=tp.user_id AND tu.email_verified=true AND tu.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$' JOIN user_access ta ON ta.user_id=tu.id AND ta.status='active' JOIN tutor_subjects ts ON ts.tutor_id=tp.id AND ts.subject_id=${row.subjectId}::uuid AND l.level=ANY(ts.levels) JOIN subjects sub ON sub.id=ts.subject_id AND sub.is_active=true WHERE tp.id=${row.tutorId}::uuid AND tp.review_status='approved' AND EXISTS(SELECT 1 FROM user_roles tr WHERE tr.user_id=tu.id AND tr.role='tutor'))` : sql``}
  `);
  if (!result.rows[0]) throw new AccessError(404);
  return new Date(result.rows[0].now);
}
function receipt(
  row: typeof bookings.$inferSelect,
  eventId: string,
  now: Date,
): DemoLifecycleReceipt {
  return {
    id: row.id,
    logicalBookingId: row.logicalBookingId,
    revision: row.revision,
    eventId,
    state: effectiveDemoState(row.state, row.expiresAt, now),
  };
}
async function replay(
  tx: Transaction,
  actorId: string,
  requestId: string,
  fingerprint: string,
  bookingId: string,
) {
  const [saved] = await tx
    .select()
    .from(bookingLifecycleEvents)
    .where(
      and(
        eq(bookingLifecycleEvents.actorUserId, actorId),
        eq(bookingLifecycleEvents.requestId, requestId),
      ),
    );
  if (!saved) return;
  if (saved.requestFingerprint !== fingerprint || saved.bookingId !== bookingId)
    throw conflict();
  const [row] = await tx
    .select()
    .from(bookings)
    .where(eq(bookings.id, saved.replacementBookingId ?? saved.bookingId));
  if (!row) throw conflict();
  return receipt(row, saved.id, await databaseNow(tx));
}
export async function readDemoRescheduleCandidates(
  runtime: AuthRuntime,
  headers: Headers,
  bookingId: string,
) {
  const actor = await requireBookingActor(runtime, headers);
  if (!z.uuid().safeParse(bookingId).success) throw new AccessError(404);
  return reservationTransaction(runtime, async (tx) => {
    const { row, tutor } = await lockBooking(tx, bookingId);
    const choice = {
      learnerId: row.learnerId,
      tutorSlug: tutor.slug,
      subjectSlug: tutor.subject,
    };
    const learner = await authorizedLearner(tx, actor, choice);
    await eligibleContext(tx, choice, learner.level);
    const now = await currentAuthority(tx, actor, row, true);
    if (
      !["demo_reserved", "demo_confirmed"].includes(row.state) ||
      row.expiresAt <= now ||
      row.startAtUtc <= now
    )
      throw conflict();
    await expireTutorReservations(tx, row.tutorId, now);
    const times = await candidateIntervals(
      tx,
      { id: row.tutorId, timezone: tutor.timezone },
      now,
      row.id,
    );
    return times
      .filter((t) => t.start.getTime() !== row.startAtUtc.getTime())
      .map((t) => ({
        startAtUtc: t.start.toISOString(),
        endAtUtc: t.end.toISOString(),
      }));
  });
}
export async function changeDemoBooking(
  runtime: AuthRuntime,
  headers: Headers,
  bookingId: string,
  action: "cancel" | "reschedule",
  input: unknown,
): Promise<DemoLifecycleReceipt> {
  const actor = await requireBookingActor(runtime, headers);
  if (!z.uuid().safeParse(bookingId).success) throw new AccessError(404);
  const reschedule =
    action === "reschedule" ? rescheduleDemoInput.parse(input) : null;
  const values = reschedule ?? cancelDemoInput.parse(input);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ bookingId, action, ...values }))
    .digest("hex");
  return reservationTransaction(runtime, async (tx) => {
    const { row, tutor } = await lockBooking(tx, bookingId);
    const choice = {
      learnerId: row.learnerId,
      tutorSlug: tutor.slug,
      subjectSlug: tutor.subject,
    };
    const learner = await authorizedLearner(tx, actor, choice);
    // Current family authority before retry; a saved receipt never supplies access.
    await currentAuthority(tx, actor, row, false);
    const saved = await replay(
      tx,
      actor.userId,
      values.requestId,
      fingerprint,
      bookingId,
    );
    if (saved) return saved;
    if (action === "reschedule")
      await eligibleContext(tx, choice, learner.level);
    const now = await currentAuthority(tx, actor, row, action === "reschedule");
    if (
      row.revision !== values.expectedRevision ||
      !["demo_reserved", "demo_confirmed"].includes(row.state) ||
      row.expiresAt <= now ||
      row.startAtUtc <= now
    )
      throw conflict();
    await expireTutorReservations(tx, row.tutorId, now);
    let replacement: typeof bookings.$inferSelect | undefined;
    if (reschedule) {
      const values = reschedule;
      const start = new Date(values.startAtUtc),
        end = new Date(values.endAtUtc);
      const candidates = await candidateIntervals(
        tx,
        { id: row.tutorId, timezone: tutor.timezone },
        await databaseNow(tx),
        row.id,
      );
      if (
        start.getTime() === row.startAtUtc.getTime() ||
        !candidates.some(
          (t) =>
            t.start.getTime() === start.getTime() &&
            t.end.getTime() === end.getTime(),
        )
      )
        throw new RuleError(
          409,
          "That time is no longer available. Please choose another.",
        );
      // Final current authority after all reads/waits; original expiry is never renewed.
      const finalNow = await currentAuthority(tx, actor, row, true);
      if (row.expiresAt <= finalNow) throw conflict();
      await tx
        .update(bookings)
        .set({ state: "demo_replaced" })
        .where(eq(bookings.id, row.id));
      const key = randomUUID();
      [replacement] = await tx
        .insert(bookings)
        .values({
          source: row.source,
          tutorId: row.tutorId,
          learnerId: row.learnerId,
          bookedByUserId: row.bookedByUserId,
          subjectId: row.subjectId,
          startAtUtc: start,
          endAtUtc: end,
          displayTimezone: values.displayTimezone,
          idempotencyKey: key,
          requestFingerprint: bookingFingerprint({
            ...choice,
            displayTimezone: values.displayTimezone,
            startAtUtc: values.startAtUtc,
            endAtUtc: values.endAtUtc,
            idempotencyKey: key,
          }),
          state: "demo_reserved",
          createdAt: finalNow,
          expiresAt: row.expiresAt,
          logicalBookingId: row.logicalBookingId,
          replacesBookingId: row.id,
          revision: row.revision + 1,
        })
        .returning();
      await tx.insert(bookingEvents).values({
        bookingId: replacement.id,
        event: "demo_reserved",
        createdAt: finalNow,
      });
    } else
      await tx
        .update(bookings)
        .set({ state: "demo_cancelled" })
        .where(eq(bookings.id, row.id));
    const [event] = await tx
      .insert(bookingLifecycleEvents)
      .values({
        logicalBookingId: row.logicalBookingId,
        bookingId: row.id,
        replacementBookingId: replacement?.id,
        actorUserId: actor.userId,
        event: action === "cancel" ? "demo_cancelled" : "demo_rescheduled",
        requestId: values.requestId,
        requestFingerprint: fingerprint,
        createdAt: await databaseNow(tx),
      })
      .returning();
    return receipt(
      replacement ?? { ...row, state: "demo_cancelled" },
      event.id,
      await databaseNow(tx),
    );
  });
}
