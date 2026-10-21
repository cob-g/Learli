import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import {
  privateActorPredicate,
  privateTutorPredicate,
  privateBookingPredicate,
} from "@/features/private-workflow/query";
import type { PrivateWorkflowPacket } from "@/features/private-workflow/config";
import {
  getPrivateWorkflow,
  assertPrivateWorkflowUnchanged,
  isPrivateWorkflow,
  privatePolicyEnvironment,
} from "@/features/private-workflow/runtime";
import { providerHeaders } from "@/features/hosted-auth/request";
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
  supportsTutorCompletion,
  localBookingPolicy,
  localParentBookingPolicy,
  localIndependentBookingPolicy,
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
import { readPrivateStaffBooking } from "./staff-read";
export type BookingWorkflowContext = {
  runtime: AuthRuntime;
  booking: BookingCapability;
};
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function localStoredPolicy(c: BookingWorkflowContext, policyId: string) {
  const base = requireBookingPolicy(c);
  if (!getLocalWorkflow(c.runtime)) return base;
  if (policyId === localBookingPolicy.policyId)
    return validateBookingCapability(
      localBookingPolicy,
      "development",
    ) as EnabledBookingPolicy;
  if (policyId === localParentBookingPolicy.policyId)
    return validateBookingCapability(
      localParentBookingPolicy,
      "development",
    ) as EnabledBookingPolicy;
  if (policyId === localIndependentBookingPolicy.policyId)
    return validateBookingCapability(
      localIndependentBookingPolicy,
      "development",
    ) as EnabledBookingPolicy;
  throw new AccessError(404);
}

/** Selection comes from the current owned learner receipt, never submitted policy/state. */
async function creationPolicy(
  tx: Transaction,
  c: BookingWorkflowContext,
  identity: { userId: string; sessionId: string },
  learnerId: string,
  key?: string,
) {
  const base = requireBookingPolicy(c);
  if (!getLocalWorkflow(c.runtime)) return base;
  if (key) {
    const prior = await tx.execute<{ policyId: string }>(sql`
      SELECT b.workflow_policy_id AS "policyId" FROM public.bookings b
      WHERE b.booked_by_user_id=${identity.userId} AND b.idempotency_key=${key}::uuid
        AND b.source='local_operation' AND public.booking_workflow_policy_current(b.workflow_policy_id)
        AND public.has_current_learner_authority(${identity.userId},${identity.sessionId},b.learner_id,b.admission_policy_id)`);
    if (prior.rows[0]) return localStoredPolicy(c, prior.rows[0].policyId);
  }
  const owned = await tx.execute<{
    management: "guardian" | "self";
    policyId: string;
  }>(sql`
    SELECT l.management,a.policy_id AS "policyId" FROM public.learner_profiles l JOIN public.learner_admissions a ON a.learner_id=l.id
    WHERE l.id=${learnerId}::uuid AND a.source='local_operation'
      AND a.policy_id IN (${localBookingPolicy.admissionPolicyId}::uuid,${localParentBookingPolicy.admissionPolicyId}::uuid,${localIndependentBookingPolicy.admissionPolicyId}::uuid)
      AND public.has_current_learner_authority(${identity.userId},${identity.sessionId},l.id,a.policy_id)`);
  if (!owned.rows[0]) throw new AccessError(404);
  if (owned.rows[0].management === "guardian")
    return localStoredPolicy(c, localParentBookingPolicy.policyId);
  return owned.rows[0].policyId ===
    localIndependentBookingPolicy.admissionPolicyId
    ? localStoredPolicy(c, localIndependentBookingPolicy.policyId)
    : base;
}

/** Historical actions keep the booking's immutable original policy. */
async function storedBookingPolicy(
  c: BookingWorkflowContext,
  headers: Headers,
  bookingId: string,
  action: WorkflowAction,
) {
  const base = requireBookingPolicy(c);
  if (!getLocalWorkflow(c.runtime)) return base;
  if (!z.uuid().safeParse(bookingId).success) throw new AccessError(404);
  const identity = await requireIdentity(c.runtime, headers);
  const rows = await c.runtime.db.execute<{ policyId: string }>(sql`
    SELECT b.workflow_policy_id AS "policyId" FROM public.bookings b
    JOIN public.tutor_profiles t ON t.id=b.tutor_id
    WHERE b.id=${bookingId}::uuid AND b.source='local_operation'
      AND public.workflow_identity(${identity.userId},${identity.sessionId},b.source)
      AND public.booking_workflow_policy_current(b.workflow_policy_id)
      AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id)
      AND (public.has_current_learner_authority(${identity.userId},${identity.sessionId},b.learner_id,b.admission_policy_id)
        OR (t.user_id=${identity.userId} AND public.has_current_tutor_screening(t.id,b.source)
          AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=${identity.userId} AND r.role='tutor'))
        OR public.has_booking_workflow_task(${identity.userId},${identity.sessionId},b.id,${action}))`);
  if (!rows.rows[0]) throw new AccessError(404);
  return localStoredPolicy(c, rows.rows[0].policyId);
}
export function requireBookingPolicy(
  c: BookingWorkflowContext,
): EnabledBookingPolicy {
  const p = validateBookingCapability(
    c.booking,
    privatePolicyEnvironment(c.runtime, "booking", c.booking),
  );
  if (
    p.authority === "disabled" ||
    (p.authority === "local_operation" && !getLocalWorkflow(c.runtime)) ||
    (!isPrivateWorkflow(c.runtime) && !isLoopbackOrigin(c.runtime.origin))
  )
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
  privatePacket: PrivateWorkflowPacket | null,
  original?: {
    state: string;
    expiresAt: Date;
    startAtUtc: Date;
    endAtUtc: Date;
  },
): Promise<WorkflowReceipt> {
  const r = await tx.execute<WorkflowReceipt>(
    sql`SELECT b.id,b.logical_booking_id AS "logicalBookingId",b.revision,b.workflow_revision AS "workflowRevision",${eventId} AS "eventId",CASE WHEN b.state='provisional' AND b.expires_at<=clock_timestamp() THEN 'expired' ELSE b.state END AS state,p.version AS "policyVersion" FROM public.bookings b JOIN public.booking_workflow_policies p ON p.id=b.workflow_policy_id WHERE ${privateBookingPredicate(privatePacket, sql`b.id`)} AND ${privateActorPredicate(privatePacket, sql`${actor.userId}`)} AND b.id=${id}::uuid AND b.workflow_policy_id=${policyId}::uuid AND public.booking_workflow_policy_current(b.workflow_policy_id) AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id) AND EXISTS(SELECT 1 FROM public.session acting JOIN public."user" au ON au.id=acting.user_id JOIN public.user_access aa ON aa.user_id=au.id AND aa.status='active' WHERE acting.id=${actor.sessionId} AND acting.user_id=${actor.userId} AND acting.expires_at>clock_timestamp() AND au.email_verified AND public.workflow_identity(${actor.userId},${actor.sessionId},b.source)) AND (public.has_current_learner_authority(${actor.userId},${actor.sessionId},b.learner_id,b.admission_policy_id) OR (${action}<>'create' AND EXISTS(SELECT 1 FROM public.tutor_profiles t JOIN public.user_roles tr ON tr.user_id=t.user_id AND tr.role='tutor' WHERE t.id=b.tutor_id AND t.user_id=${actor.userId} AND public.has_current_tutor_screening(t.id,b.source))) OR public.has_booking_workflow_task(${actor.userId},${actor.sessionId},b.id,${action}))`,
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

async function currentActorTimezone(
  tx: Transaction,
  identity: { userId: string; sessionId: string },
) {
  const result = await tx.execute<{ timezone: string }>(sql`
    SELECT u.timezone
    FROM public."user" u
    JOIN public.user_access a ON a.user_id=u.id AND a.status='active'
    JOIN public.session s ON s.user_id=u.id AND s.id=${identity.sessionId}
      AND s.expires_at>clock_timestamp()
    WHERE u.id=${identity.userId} AND u.email_verified`);
  if (!result.rows[0]) throw new AccessError(404);
  return result.rows[0].timezone;
}

async function currentChoice(
  tx: Transaction,
  id: { userId: string; sessionId: string },
  p: EnabledBookingPolicy,
  v: z.infer<typeof workflowChoice>,
  privatePacket: PrivateWorkflowPacket | null,
) {
  const learnerAuthority =
    p.version === "local-parent-booking-v2"
      ? sql`EXISTS(SELECT 1 FROM public.learner_admissions a WHERE a.learner_id=l.id AND a.management='guardian' AND a.source='local_operation' AND a.policy_id IN (${p.acceptedGuardianPolicyIds[0]}::uuid,${p.acceptedGuardianPolicyIds[1]}::uuid) AND public.has_current_learner_authority(${id.userId},${id.sessionId},l.id,a.policy_id))`
      : sql`public.has_current_learner_authority(${id.userId},${id.sessionId},l.id,${p.admissionPolicyId}::uuid)`;
  const r = await tx.execute<{
    id: string;
    timezone: string;
    subjectId: string;
  }>(
    sql`SELECT t.id,t.timezone,s.id AS "subjectId" FROM public.tutor_profiles t JOIN public.subjects s ON s.slug=${v.subjectSlug} AND s.is_active JOIN public.tutor_subjects ts ON ts.tutor_id=t.id AND ts.subject_id=s.id JOIN public.learner_profiles l ON l.id=${v.learnerId}::uuid AND l.level=ANY(ts.levels) WHERE ${privateTutorPredicate(privatePacket, sql`t.id`)} AND ${privateActorPredicate(privatePacket, sql`${id.userId}`)} AND t.slug=${v.tutorSlug} AND public.booking_workflow_policy_current(${p.policyId}::uuid) AND ${learnerAuthority} AND public.has_current_tutor_screening(t.id,${p.source}) AND t.review_status='approved' AND EXISTS(SELECT 1 FROM public."user" u JOIN public.user_access a ON a.user_id=u.id AND a.status='active' JOIN public.user_roles r ON r.user_id=u.id AND r.role='tutor' WHERE u.id=t.user_id AND u.email_verified AND (${p.source}='local_operation' OR u.email LIKE '%.test'))`,
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
  const current = await c.runtime.db.execute<{
    ok: boolean;
    immediateConfirmationLearnerIds: string[];
  }>(
    sql`SELECT public.booking_workflow_policy_current(${p.policyId}::uuid) AND EXISTS(SELECT 1 FROM public.session s WHERE s.id=${id.sessionId} AND s.user_id=${id.userId} AND s.expires_at>clock_timestamp()) AS ok,
      COALESCE(ARRAY(
        SELECT a.learner_id::text FROM public.learner_admissions a
        WHERE ${getLocalWorkflow(c.runtime) !== null}
          AND a.policy_id IN (${localParentBookingPolicy.admissionPolicyId}::uuid,${localIndependentBookingPolicy.admissionPolicyId}::uuid)
          AND public.has_current_learner_authority(${id.userId},${id.sessionId},a.learner_id,a.policy_id)
          AND ((a.policy_id=${localParentBookingPolicy.admissionPolicyId}::uuid AND public.booking_workflow_policy_current(${localParentBookingPolicy.policyId}::uuid))
            OR (a.policy_id=${localIndependentBookingPolicy.admissionPolicyId}::uuid AND public.booking_workflow_policy_current(${localIndependentBookingPolicy.policyId}::uuid)))
        ORDER BY a.learner_id
      ),ARRAY[]::text[]) AS "immediateConfirmationLearnerIds"`,
  );
  if (!current.rows[0]?.ok) throw new AccessError(503);
  const currentSession = await c.runtime.auth.api.getSession({
    headers: providerHeaders(c.runtime, headers),
    query: { disableCookieCache: true },
  });
  if (!currentSession || currentSession.session.id !== id.sessionId)
    throw new AccessError(401);
  return {
    learners,
    tutors: await listEligibleTutors(
      c.runtime.db,
      {},
      p.source,
      getPrivateWorkflow(c.runtime),
    ),
    timezone: currentSession.user.timezone,
    immediateConfirmationLearnerIds:
      current.rows[0].immediateConfirmationLearnerIds,
  };
}
export async function readWorkflowCandidates(
  c: BookingWorkflowContext,
  headers: Headers,
  input: unknown,
) {
  const id = await actor(c, headers),
    v = workflowChoice.parse(input);
  return workflowTransaction(c.runtime, async (tx) => {
    const p = await creationPolicy(tx, c, id, v.learnerId);
    await tx
      .select({ id: tutorProfiles.id })
      .from(tutorProfiles)
      .where(eq(tutorProfiles.slug, v.tutorSlug))
      .for("update");
    const tutor = await currentChoice(
      tx,
      id,
      p,
      v,
      getPrivateWorkflow(c.runtime),
    );
    const slots = await candidateIntervals(tx, tutor, p);
    await currentChoice(tx, id, p, v, getPrivateWorkflow(c.runtime));
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
  const id = await actor(c, headers),
    v = workflowCreate.parse(input),
    hash = fingerprint(v);
  return workflowTransaction(c.runtime, async (tx) => {
    const p = await creationPolicy(tx, c, id, v.learnerId, v.idempotencyKey);
    await tx
      .select({ id: tutorProfiles.id })
      .from(tutorProfiles)
      .where(eq(tutorProfiles.slug, v.tutorSlug))
      .for("update");
    const tutor = await currentChoice(
      tx,
      id,
      p,
      v,
      getPrivateWorkflow(c.runtime),
    );
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
      getPrivateWorkflow(c.runtime),
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
  const p = await storedBookingPolicy(c, headers, bookingId, action),
    id =
      ["confirm", "complete", "no_show"].includes(action) &&
      !(action === "complete" && supportsTutorCompletion(p))
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
    let trustedMove = moved;
    if (moved) {
      // Participants only, before the time zone and slot checks, so an
      // outsider gets 404 rather than a 409 that confirms the booking exists.
      // change_policy_booking still applies the exact action rule.
      const t = await tx.execute<{ id: string; timezone: string }>(
        sql`SELECT t.id,t.timezone FROM public.tutor_profiles t JOIN public.bookings b ON b.tutor_id=t.id WHERE b.id=${bookingId}::uuid AND public.booking_workflow_participant(${id.userId},${id.sessionId},b.id)`,
      );
      if (!t.rows[0]) throw new AccessError(404);
      const displayTimezone = await currentActorTimezone(tx, id);
      if (moved.displayTimezone !== displayTimezone)
        throw new RuleError(
          409,
          "Your account time zone changed. Reload current times and try again.",
        );
      const trusted = {
        ...moved,
        displayTimezone,
      };
      trustedMove = trusted;
      const prior = await tx.execute<{ id: string }>(
        sql`SELECT id FROM public.booking_lifecycle_events WHERE actor_user_id=${id.userId} AND request_id=${v.requestId}::uuid`,
      );
      if (!prior.rows.length) {
        const slots = await candidateIntervals(tx, t.rows[0], p, bookingId);
        if (
          !slots.some(
            (t) =>
              t.start.toISOString() ===
                new Date(trusted.startAtUtc).toISOString() &&
              t.end.toISOString() === new Date(trusted.endAtUtc).toISOString(),
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
      sql`SELECT * FROM public.change_policy_booking(${id.userId},${id.sessionId},${bookingId}::uuid,${v.requestId}::uuid,${p.policyId}::uuid,${v.expectedRevision},${action},${v.reasonCode},${trustedMove?.startAtUtc ?? null}::timestamptz,${trustedMove?.endAtUtc ?? null}::timestamptz,${trustedMove?.displayTimezone ?? null},${fingerprint({ bookingId, action, ...(trustedMove ?? v) })})`,
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
      getPrivateWorkflow(c.runtime),
      original,
    );
  });
}
export async function readWorkflowTask(
  c: BookingWorkflowContext,
  headers: Headers,
  bookingId: string,
) {
  const packet = getPrivateWorkflow(c.runtime);
  if (packet || getLocalWorkflow(c.runtime))
    return readPrivateStaffBooking(c, headers, bookingId);
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
    sql`SELECT b.id,b.state,b.workflow_revision AS "workflowRevision",b.start_at_utc::text AS start,b.end_at_utc::text AS "end",u.timezone,s.name AS subject,ARRAY(SELECT g.action FROM public.booking_workflow_grants g WHERE g.logical_booking_id=b.logical_booking_id AND g.actor_user_id=${id.userId} AND public.has_booking_workflow_task(${id.userId},${id.sessionId},b.id,g.action)) AS actions FROM public.bookings b JOIN public.subjects s ON s.id=b.subject_id JOIN public."user" u ON u.id=${id.userId} WHERE ${privateBookingPredicate(getPrivateWorkflow(c.runtime), sql`b.id`)} AND ${privateActorPredicate(getPrivateWorkflow(c.runtime), sql`${id.userId}`)} AND b.id=${bookingId}::uuid AND b.source=${p.source} AND b.workflow_policy_id=${p.policyId}::uuid AND public.booking_workflow_policy_current(b.workflow_policy_id) AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id) AND public.has_current_tutor_screening(b.tutor_id,b.source) AND EXISTS(SELECT 1 FROM public.booking_workflow_grants g WHERE g.logical_booking_id=b.logical_booking_id AND public.has_booking_workflow_task(${id.userId},${id.sessionId},b.id,g.action))`,
  );
  if (!r.rows[0]) throw new AccessError(404);
  assertPrivateWorkflowUnchanged(c.runtime, packet);
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
/** Presentation eligibility only; the authoritative mutation rechecks the actor,
 * policy, beneficiary, tutor eligibility, revision and scheduled end. */
export async function readTutorCompletion(
  c: BookingWorkflowContext,
  headers: Headers,
  bookingId: string,
) {
  const p = await storedBookingPolicy(c, headers, bookingId, "complete");
  if (!supportsTutorCompletion(p)) return null;
  const id = await actor(c, headers);
  if (!z.uuid().safeParse(bookingId).success) throw new AccessError(404);
  const rows = await c.runtime.db.execute<{
    id: string;
    workflowRevision: number;
  }>(sql`
    SELECT b.id,b.workflow_revision AS "workflowRevision"
    FROM public.bookings b
    WHERE ${privateBookingPredicate(getPrivateWorkflow(c.runtime), sql`b.id`)} AND ${privateActorPredicate(getPrivateWorkflow(c.runtime), sql`${id.userId}`)} AND b.id=${bookingId}::uuid AND b.workflow_policy_id=${p.policyId}::uuid
      AND b.source=${p.source} AND b.state='confirmed'
      AND b.end_at_utc<=clock_timestamp()
      AND public.has_booking_workflow_task(${id.userId},${id.sessionId},b.id,'complete')
  `);
  return rows.rows[0] ?? null;
}
export async function readWorkflowMoveCandidates(
  c: BookingWorkflowContext,
  headers: Headers,
  bookingId: string,
) {
  const p = await storedBookingPolicy(c, headers, bookingId, "reschedule"),
    id = await actor(c, headers);
  z.uuid().parse(bookingId);
  return workflowTransaction(c.runtime, async (tx) => {
    await tx.execute(
      sql`SELECT t.id FROM public.tutor_profiles t JOIN public.bookings b ON b.tutor_id=t.id WHERE b.id=${bookingId}::uuid FOR UPDATE OF t`,
    );
    const result = await tx.execute<{ id: string; timezone: string }>(
      sql`SELECT t.id,t.timezone FROM public.bookings b JOIN public.tutor_profiles t ON t.id=b.tutor_id WHERE ${privateBookingPredicate(getPrivateWorkflow(c.runtime), sql`b.id`)} AND ${privateActorPredicate(getPrivateWorkflow(c.runtime), sql`${id.userId}`)} AND b.id=${bookingId}::uuid AND b.source=${p.source} AND b.state IN('provisional','confirmed') AND (b.state='confirmed' OR b.expires_at>clock_timestamp()) AND b.start_at_utc>clock_timestamp()+interval '60 minutes' AND b.workflow_policy_id=${p.policyId}::uuid AND public.booking_workflow_policy_current(b.workflow_policy_id) AND public.has_current_learner_authority(${id.userId},${id.sessionId},b.learner_id,b.admission_policy_id) AND public.has_current_tutor_screening(t.id,${p.source})`,
    );
    if (!result.rows[0]) throw new AccessError(404);
    const slots = await candidateIntervals(tx, result.rows[0], p, bookingId);
    const fresh = await tx.execute<{ id: string; timezone: string }>(
      sql`SELECT t.id,t.timezone FROM public.bookings b JOIN public.tutor_profiles t ON t.id=b.tutor_id WHERE ${privateBookingPredicate(getPrivateWorkflow(c.runtime), sql`b.id`)} AND ${privateActorPredicate(getPrivateWorkflow(c.runtime), sql`${id.userId}`)} AND b.id=${bookingId}::uuid AND b.source=${p.source} AND b.state IN('provisional','confirmed') AND (b.state='confirmed' OR b.expires_at>clock_timestamp()) AND b.start_at_utc>clock_timestamp()+interval '60 minutes' AND b.workflow_policy_id=${p.policyId}::uuid AND public.booking_workflow_policy_current(b.workflow_policy_id) AND public.has_current_learner_authority(${id.userId},${id.sessionId},b.learner_id,b.admission_policy_id) AND public.has_current_tutor_screening(t.id,${p.source})`,
    );
    if (!fresh.rows[0]) throw new AccessError(404);
    const displayTimezone = await currentActorTimezone(tx, id);
    return slots.map((t) => formatLessonTime(t.start, t.end, displayTimezone));
  });
}

async function workflowTransaction<T>(
  runtime: AuthRuntime,
  run: (tx: Transaction) => Promise<T>,
) {
  try {
    const packet = getPrivateWorkflow(runtime);
    return await reservationTransaction(runtime, async (tx) => {
      getLocalWorkflow(runtime);
      assertPrivateWorkflowUnchanged(runtime, packet);
      const result = await run(tx);
      getLocalWorkflow(runtime);
      assertPrivateWorkflowUnchanged(runtime, packet);
      return result;
    });
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
