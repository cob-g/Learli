import { requireAdminAssurance } from "@/features/admin-security/assurance";
import { pgErrorCode } from "@/lib/db/errors";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import type { Database } from "@/lib/db/connection";
import { bookings, tutorProfiles, tutorAvailability } from "@/lib/db/schema";
import { requireIdentity, AccessError } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import { isLoopbackOrigin } from "@/lib/local-mode";
import { generateSlots } from "@/lib/time/availability";
import { readTutorTimeOffIntervals } from "@/features/time-off/repository";
import { listAdmittedLearners } from "@/features/learner-admission/service";
import { admissionContext } from "@/features/learner-admission/context";
import { listEligibleTutors } from "@/features/tutors/eligibility";
import {
  databaseNow,
  expireTutorReservations,
  reservationTransaction,
} from "@/features/bookings/service";
import { formatLessonTime } from "@/features/bookings/format-time";
import {
  validateBookingCapability,
  type BookingCapability,
  type EnabledBookingPolicy,
} from "./policy";
import {
  workflowChoice,
  workflowCreate,
  workflowChange,
  workflowMove,
  type WorkflowAction,
} from "./input";
import { blockingBookingPredicate, type WorkflowReceipt } from "./model";
export type BookingWorkflowContext = {
  runtime: AuthRuntime;
  booking: BookingCapability;
};
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export function requireBookingPolicy(
  c: BookingWorkflowContext,
): EnabledBookingPolicy {
  const p = validateBookingCapability(c.booking, c.runtime.environment);
  if (p.authority === "disabled" || !isLoopbackOrigin(c.runtime.origin))
    throw new AccessError(503);
  return p;
}
async function actor(c: BookingWorkflowContext, headers: Headers) {
  requireBookingPolicy(c);
  return requireIdentity(c.runtime, headers);
}
const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
function saved(
  row:
    | { outcome: string; booking_id: string | null; event_id: string | null }
    | undefined,
) {
  if (row?.outcome === "forbidden") throw new AccessError(404);
  if (row?.outcome === "policy_unavailable") throw new AccessError(503);
  if (row?.outcome === "invalid")
    throw new RuleError(400, "Check the booking fields and try again.");
  if (!row?.booking_id || !row.event_id)
    throw new RuleError(
      409,
      "That booking or time changed. Reload current details and choose again.",
    );
  return { id: row.booking_id, eventId: row.event_id };
}
async function receipt(
  tx: Transaction,
  id: string,
  eventId: string,
  actor: { userId: string; sessionId: string },
  action: WorkflowAction | "create",
  policyId: string,
  replayed: boolean,
  original?: {
    state: string;
    expiresAt: Date;
    startAtUtc: Date;
    endAtUtc: Date;
  },
): Promise<WorkflowReceipt> {
  const r = await tx.execute<WorkflowReceipt>(
    sql`SELECT b.id,b.logical_booking_id AS "logicalBookingId",b.revision,b.workflow_revision AS "workflowRevision",${eventId} AS "eventId",CASE WHEN b.state='provisional' AND b.expires_at<=clock_timestamp() THEN 'expired' ELSE b.state END AS state,p.version AS "policyVersion" FROM public.bookings b JOIN public.booking_workflow_policies p ON p.id=b.workflow_policy_id WHERE b.id=${id}::uuid AND b.workflow_policy_id=${policyId}::uuid AND public.booking_workflow_policy_current(b.workflow_policy_id) AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id) AND EXISTS(SELECT 1 FROM public.session acting JOIN public."user" au ON au.id=acting.user_id JOIN public.user_access aa ON aa.user_id=au.id AND aa.status='active' WHERE acting.id=${actor.sessionId} AND acting.user_id=${actor.userId} AND acting.expires_at>clock_timestamp() AND au.email_verified AND au.email LIKE '%.test') AND (public.has_current_learner_authority(${actor.userId},${actor.sessionId},b.learner_id,b.admission_policy_id) OR (${action}<>'create' AND EXISTS(SELECT 1 FROM public.tutor_profiles t JOIN public.user_roles tr ON tr.user_id=t.user_id AND tr.role='tutor' WHERE t.id=b.tutor_id AND t.user_id=${actor.userId} AND public.has_current_tutor_screening(t.id,'synthetic_readiness'))) OR public.has_booking_workflow_task(${actor.userId},${actor.sessionId},b.id,${action}))`,
  );
  if (!r.rows[0]) throw new AccessError(404);
  const stored = await tx
    .select({
      state: bookings.state,
      expiresAt: bookings.expiresAt,
      startAtUtc: bookings.startAtUtc,
      endAtUtc: bookings.endAtUtc,
    })
    .from(bookings)
    .where(eq(bookings.id, id));
  const prior = original ?? stored[0];
  if (!prior) throw new AccessError(404);
  await tx.execute(
    sql`SELECT public.assert_booking_workflow_receipt(${actor.userId},${actor.sessionId},${id}::uuid,${eventId}::uuid,${action},${policyId}::uuid,${replayed},${prior.state},${prior.expiresAt}::timestamptz,${prior.startAtUtc}::timestamptz,${prior.endAtUtc}::timestamptz)`,
  );
  return r.rows[0];
}
async function candidateIntervals(
  tx: Transaction,
  tutor: { id: string; timezone: string },
  p: EnabledBookingPolicy,
  exclude?: string,
) {
  const now = await databaseNow(tx),
    from = new Date(now.getTime() + p.noticeMinutes * 60000),
    to = new Date(now.getTime() + p.horizonDays * 86400000);
  const windows = await tx
    .select({
      isoWeekday: tutorAvailability.isoWeekday,
      startMinute: tutorAvailability.startMinute,
      endMinute: tutorAvailability.endMinute,
    })
    .from(tutorAvailability)
    .where(eq(tutorAvailability.tutorId, tutor.id));
  const occupied = await tx.execute<{ start: string; end: string }>(
    sql`SELECT b.start_at_utc AS start,b.end_at_utc AS "end" FROM public.bookings b WHERE b.tutor_id=${tutor.id}::uuid AND (${exclude ?? null}::uuid IS NULL OR b.id<>${exclude ?? null}::uuid) AND ${blockingBookingPredicate(sql`b`, now)}`,
  );
  const exceptions = await readTutorTimeOffIntervals(
    tx,
    tutor.id,
    from,
    new Date(to.getTime() + p.durationMinutes * 60000),
  );
  return generateSlots({
    timeZone: tutor.timezone,
    windows,
    busy: [
      ...exceptions,
      ...occupied.rows.map((r) => ({
        start: new Date(r.start),
        end: new Date(r.end),
      })),
    ],
    from,
    to,
    slotMinutes: p.durationMinutes,
    stepMinutes: p.stepMinutes,
  });
}
async function currentChoice(
  tx: Transaction,
  id: { userId: string; sessionId: string },
  p: EnabledBookingPolicy,
  v: z.infer<typeof workflowChoice>,
) {
  const r = await tx.execute<{
    id: string;
    timezone: string;
    subjectId: string;
  }>(
    sql`SELECT t.id,t.timezone,s.id AS "subjectId" FROM public.tutor_profiles t JOIN public.subjects s ON s.slug=${v.subjectSlug} AND s.is_active JOIN public.tutor_subjects ts ON ts.tutor_id=t.id AND ts.subject_id=s.id JOIN public.learner_profiles l ON l.id=${v.learnerId}::uuid AND l.level=ANY(ts.levels) WHERE t.slug=${v.tutorSlug} AND public.booking_workflow_policy_current(${p.policyId}::uuid) AND public.has_current_learner_authority(${id.userId},${id.sessionId},l.id,${p.admissionPolicyId}::uuid) AND public.has_current_tutor_screening(t.id,'synthetic_readiness') AND t.review_status='approved' AND EXISTS(SELECT 1 FROM public."user" u JOIN public.user_access a ON a.user_id=u.id AND a.status='active' JOIN public.user_roles r ON r.user_id=u.id AND r.role='tutor' WHERE u.id=t.user_id AND u.email_verified AND u.email LIKE '%.test')`,
  );
  if (!r.rows[0]) throw new AccessError(404);
  return r.rows[0];
}
export async function loadWorkflowOptions(
  c: BookingWorkflowContext,
  headers: Headers,
) {
  const p = requireBookingPolicy(c),
    id = await actor(c, headers);
  const admission = admissionContext(c.runtime);
  // Test-owned composition installs W5 capability separately; no inferred authority.
  const learners = await listAdmittedLearners(admission, headers);
  const current = await c.runtime.db.execute<{ ok: boolean }>(
    sql`SELECT public.booking_workflow_policy_current(${p.policyId}::uuid) AND EXISTS(SELECT 1 FROM public.session s WHERE s.id=${id.sessionId} AND s.user_id=${id.userId} AND s.expires_at>clock_timestamp()) AS ok`,
  );
  if (!current.rows[0]?.ok) throw new AccessError(503);
  const currentSession = await c.runtime.auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
  });
  if (!currentSession || currentSession.session.id !== id.sessionId)
    throw new AccessError(401);
  return {
    learners,
    tutors: await listEligibleTutors(c.runtime.db, {}, "synthetic_readiness"),
    timezone: currentSession.user.timezone,
  };
}
export async function readWorkflowCandidates(
  c: BookingWorkflowContext,
  headers: Headers,
  input: unknown,
) {
  const p = requireBookingPolicy(c),
    id = await actor(c, headers),
    v = workflowChoice.parse(input);
  return workflowTransaction(c.runtime, async (tx) => {
    await tx
      .select({ id: tutorProfiles.id })
      .from(tutorProfiles)
      .where(eq(tutorProfiles.slug, v.tutorSlug))
      .for("update");
    const tutor = await currentChoice(tx, id, p, v);
    const slots = await candidateIntervals(tx, tutor, p);
    await currentChoice(tx, id, p, v);
    return slots.map((t) =>
      formatLessonTime(t.start, t.end, v.displayTimezone),
    );
  });
}
export async function createPolicyReservation(
  c: BookingWorkflowContext,
  headers: Headers,
  input: unknown,
) {
  const p = requireBookingPolicy(c),
    id = await actor(c, headers),
    v = workflowCreate.parse(input),
    hash = fingerprint(v);
  return workflowTransaction(c.runtime, async (tx) => {
    await tx
      .select({ id: tutorProfiles.id })
      .from(tutorProfiles)
      .where(eq(tutorProfiles.slug, v.tutorSlug))
      .for("update");
    const tutor = await currentChoice(tx, id, p, v);
    const existing = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.bookedByUserId, id.userId),
          eq(bookings.idempotencyKey, v.idempotencyKey),
        ),
      );
    if (!existing.length) {
      const times = await candidateIntervals(tx, tutor, p);
      if (
        !times.some(
          (t) =>
            t.start.toISOString() === new Date(v.startAtUtc).toISOString() &&
            t.end.toISOString() === new Date(v.endAtUtc).toISOString(),
        )
      )
        throw new RuleError(
          409,
          "That time is no longer available. Please choose another.",
        );
      await expireTutorReservations(tx, tutor.id, await databaseNow(tx));
    }
    const result = await tx.execute<{
      outcome: string;
      booking_id: string | null;
      event_id: string | null;
    }>(
      sql`SELECT * FROM public.create_policy_booking(${id.userId},${id.sessionId},${v.idempotencyKey}::uuid,${p.policyId}::uuid,${v.learnerId}::uuid,${tutor.id}::uuid,${tutor.subjectId}::uuid,${v.startAtUtc}::timestamptz,${v.endAtUtc}::timestamptz,${v.displayTimezone},${hash})`,
    );
    const r = saved(result.rows[0]);
    return receipt(
      tx,
      r.id,
      r.eventId,
      id,
      "create",
      p.policyId,
      result.rows[0]?.outcome === "replayed",
    );
  });
}
export async function changePolicyBooking(
  c: BookingWorkflowContext,
  headers: Headers,
  bookingId: string,
  action: WorkflowAction,
  input: unknown,
) {
  const p = requireBookingPolicy(c),
    id = ["confirm", "complete", "no_show"].includes(action)
      ? await requireAdminAssurance(c.runtime, headers)
      : await actor(c, headers),
    moved = action === "reschedule" ? workflowMove.parse(input) : null,
    v = moved ?? workflowChange.parse(input);
  z.uuid().parse(bookingId);
  return workflowTransaction(c.runtime, async (tx) => {
    await tx.execute(
      sql`SELECT t.id FROM public.tutor_profiles t JOIN public.bookings b ON b.tutor_id=t.id WHERE b.id=${bookingId}::uuid FOR UPDATE OF t`,
    );
    const [original] = await tx
      .select({
        state: bookings.state,
        expiresAt: bookings.expiresAt,
        startAtUtc: bookings.startAtUtc,
        endAtUtc: bookings.endAtUtc,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .for("no key update");
    if (!original) throw new AccessError(404);
    if (moved) {
      const t = await tx.execute<{ id: string; timezone: string }>(
        sql`SELECT t.id,t.timezone FROM public.tutor_profiles t JOIN public.bookings b ON b.tutor_id=t.id WHERE b.id=${bookingId}::uuid`,
      );
      if (!t.rows[0]) throw new AccessError(404);
      const prior = await tx.execute<{ id: string }>(
        sql`SELECT id FROM public.booking_lifecycle_events WHERE actor_user_id=${id.userId} AND request_id=${v.requestId}::uuid`,
      );
      if (!prior.rows.length) {
        const slots = await candidateIntervals(tx, t.rows[0], p, bookingId);
        if (
          !slots.some(
            (t) =>
              t.start.toISOString() ===
                new Date(moved.startAtUtc).toISOString() &&
              t.end.toISOString() === new Date(moved.endAtUtc).toISOString(),
          )
        )
          throw new RuleError(
            409,
            "That time is no longer available. Please choose another.",
          );
        await expireTutorReservations(tx, t.rows[0].id, await databaseNow(tx));
      }
    }

    const result = await tx.execute<{
      outcome: string;
      booking_id: string | null;
      event_id: string | null;
    }>(
      sql`SELECT * FROM public.change_policy_booking(${id.userId},${id.sessionId},${bookingId}::uuid,${v.requestId}::uuid,${p.policyId}::uuid,${v.expectedRevision},${action},${v.reasonCode},${moved?.startAtUtc ?? null}::timestamptz,${moved?.endAtUtc ?? null}::timestamptz,${moved?.displayTimezone ?? null},${fingerprint({ bookingId, action, ...v })})`,
    );
    const r = saved(result.rows[0]);
    return receipt(
      tx,
      r.id,
      r.eventId,
      id,
      action,
      p.policyId,
      result.rows[0]?.outcome === "replayed",
      original,
    );
  });
}
export async function readWorkflowTask(
  c: BookingWorkflowContext,
  headers: Headers,
  bookingId: string,
) {
  const p = requireBookingPolicy(c),
    id = await requireAdminAssurance(c.runtime, headers);
  if (!z.uuid().safeParse(bookingId).success) throw new AccessError(404);
  const r = await c.runtime.db.execute<{
    id: string;
    state: string;
    workflowRevision: number;
    start: string;
    end: string;
    timezone: string;
    subject: string;
    actions: WorkflowAction[];
  }>(
    sql`SELECT b.id,b.state,b.workflow_revision AS "workflowRevision",b.start_at_utc::text AS start,b.end_at_utc::text AS "end",u.timezone,s.name AS subject,ARRAY(SELECT g.action FROM public.booking_workflow_grants g WHERE g.logical_booking_id=b.logical_booking_id AND g.actor_user_id=${id.userId} AND public.has_booking_workflow_task(${id.userId},${id.sessionId},b.id,g.action)) AS actions FROM public.bookings b JOIN public.subjects s ON s.id=b.subject_id JOIN public."user" u ON u.id=${id.userId} WHERE b.id=${bookingId}::uuid AND b.source='synthetic_readiness' AND b.workflow_policy_id=${p.policyId}::uuid AND public.booking_workflow_policy_current(b.workflow_policy_id) AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id) AND public.has_current_tutor_screening(b.tutor_id,'synthetic_readiness') AND EXISTS(SELECT 1 FROM public.booking_workflow_grants g WHERE g.logical_booking_id=b.logical_booking_id AND public.has_booking_workflow_task(${id.userId},${id.sessionId},b.id,g.action))`,
  );
  if (!r.rows[0]) throw new AccessError(404);
  const row = r.rows[0];
  return {
    ...row,
    time: formatLessonTime(
      new Date(row.start),
      new Date(row.end),
      row.timezone,
    ),
  };
}
export async function readWorkflowMoveCandidates(
  c: BookingWorkflowContext,
  headers: Headers,
  bookingId: string,
) {
  const p = requireBookingPolicy(c),
    id = await actor(c, headers);
  z.uuid().parse(bookingId);
  return workflowTransaction(c.runtime, async (tx) => {
    await tx.execute(
      sql`SELECT t.id FROM public.tutor_profiles t JOIN public.bookings b ON b.tutor_id=t.id WHERE b.id=${bookingId}::uuid FOR UPDATE OF t`,
    );
    const result = await tx.execute<{ id: string; timezone: string }>(
      sql`SELECT t.id,t.timezone FROM public.bookings b JOIN public.tutor_profiles t ON t.id=b.tutor_id WHERE b.id=${bookingId}::uuid AND b.source='synthetic_readiness' AND b.state IN('provisional','confirmed') AND (b.state='confirmed' OR b.expires_at>clock_timestamp()) AND b.start_at_utc>clock_timestamp()+interval '60 minutes' AND b.workflow_policy_id=${p.policyId}::uuid AND public.booking_workflow_policy_current(b.workflow_policy_id) AND public.has_current_learner_authority(${id.userId},${id.sessionId},b.learner_id,b.admission_policy_id) AND public.has_current_tutor_screening(t.id,'synthetic_readiness')`,
    );
    if (!result.rows[0]) throw new AccessError(404);
    const slots = await candidateIntervals(tx, result.rows[0], p, bookingId);
    const fresh = await tx.execute<{ id: string; timezone: string }>(
      sql`SELECT t.id,t.timezone FROM public.bookings b JOIN public.tutor_profiles t ON t.id=b.tutor_id WHERE b.id=${bookingId}::uuid AND b.source='synthetic_readiness' AND b.state IN('provisional','confirmed') AND (b.state='confirmed' OR b.expires_at>clock_timestamp()) AND b.start_at_utc>clock_timestamp()+interval '60 minutes' AND b.workflow_policy_id=${p.policyId}::uuid AND public.booking_workflow_policy_current(b.workflow_policy_id) AND public.has_current_learner_authority(${id.userId},${id.sessionId},b.learner_id,b.admission_policy_id) AND public.has_current_tutor_screening(t.id,'synthetic_readiness')`,
    );
    if (!fresh.rows[0]) throw new AccessError(404);
    return slots.map((t) => formatLessonTime(t.start, t.end, "UTC"));
  });
}

async function workflowTransaction<T>(
  runtime: AuthRuntime,
  run: (tx: Transaction) => Promise<T>,
) {
  try {
    return await reservationTransaction(runtime, run);
  } catch (e) {
    const code = pgErrorCode(e);
    if (code === "42501") throw new AccessError(404);
    if (code === "P4090")
      throw new RuleError(
        409,
        "The booking window changed. Reload current details.",
      );
    throw e;
  }
}

export async function createBookingDispute(
  c: BookingWorkflowContext,
  headers: Headers,
  bookingId: string,
  input: unknown,
  response?: import("@/features/safeguarding/service").SafeguardingContext,
) {
  requireBookingPolicy(c);
  const { getSafeguardingContext } =
      await import("@/features/safeguarding/composition"),
    { requireSafeguarding } = await import("@/features/safeguarding/service"),
    { safeguardingCaseInput } = await import("@/features/safeguarding/input");
  const scope = response ?? getSafeguardingContext(c.runtime),
    cap = requireSafeguarding(scope),
    id = await actor(c, headers),
    v = safeguardingCaseInput.parse(input);
  z.uuid().parse(bookingId);
  return workflowTransaction(c.runtime, async (tx) => {
    const r = await tx.execute<{ outcome: string; case_id: string | null }>(
      sql`SELECT * FROM public.create_booking_workflow_dispute(${id.userId},${id.sessionId},${bookingId}::uuid,${v.requestKey}::uuid,${cap.version},${v.category},${v.subject},${v.body})`,
    );
    if (r.rows[0]?.outcome === "forbidden") throw new AccessError(404);
    if (!r.rows[0]?.case_id)
      throw new RuleError(
        409,
        "The dispute request could not be saved. Reload current booking details.",
      );
    return { id: r.rows[0].case_id };
  });
}
