import { sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import type { LearnerLevel } from "@/lib/db/schema";
import { AccessError } from "@/lib/permissions/access";
import { requireAdminAssurance } from "@/features/admin-security/assurance";
import { formatLessonTime } from "@/features/bookings/format-time";
import {
  privateActorPredicate,
  privateBookingPredicate,
} from "@/features/private-workflow/query";
import {
  getPrivateWorkflow,
  assertPrivateWorkflowUnchanged,
} from "@/features/private-workflow/runtime";
import { validateBookingCapability, type BookingCapability } from "./policy";
import type { WorkflowAction } from "./input";
import type { WorkflowState } from "./model";
import { staffBookingInput, type StaffBookingFilters } from "./staff-input";

type Context = { runtime: AuthRuntime; booking: BookingCapability };
type StoredStaffBooking = {
  id: string;
  logicalBookingId: string;
  revision: number;
  workflowRevision: number;
  state: WorkflowState;
  start: string;
  end: string;
  timezone: string;
  subject: string;
  tutorName: string;
  learnerName: string;
  learnerLevel: LearnerLevel;
  requesterName: string;
  relationship: "self" | "guardian";
  actions: WorkflowAction[];
};
export type StaffBooking = StoredStaffBooking & {
  time: ReturnType<typeof formatLessonTime>;
};

/** One SQL authorization snapshot shared by assigned private list and detail.
 * No meeting table, contact columns, universal Admin or participant fallback. */
async function queryStaffBookings(
  c: Context,
  headers: Headers,
  filters: StaffBookingFilters,
  bookingId?: string,
) {
  const packet = getPrivateWorkflow(c.runtime);
  if (!packet) throw new AccessError(503);
  const policy = validateBookingCapability(c.booking, "test");
  if (
    policy.authority === "disabled" ||
    JSON.stringify(policy) !== JSON.stringify(packet.booking)
  )
    throw new AccessError(503);
  const actor = await requireAdminAssurance(c.runtime, headers);
  const effectiveState = sql`CASE WHEN b.state='provisional' AND b.expires_at<=statement_timestamp() THEN 'expired' ELSE b.state END`;
  const currentTutor = sql`t.review_status='approved' AND EXISTS(SELECT 1 FROM public."user" acting_tutor
    JOIN public.user_access tutor_access ON tutor_access.user_id=acting_tutor.id AND tutor_access.status='active'
    WHERE acting_tutor.id=t.user_id AND acting_tutor.email_verified AND acting_tutor.email LIKE '%.test'
      AND EXISTS(SELECT 1 FROM public.user_roles tutor_role WHERE tutor_role.user_id=acting_tutor.id AND tutor_role.role='tutor'))`;
  const result = await c.runtime.db.execute<StoredStaffBooking>(sql`
    SELECT b.id,b.logical_booking_id AS "logicalBookingId",b.revision,b.workflow_revision AS "workflowRevision",
      ${effectiveState} AS state,b.start_at_utc::text AS start,b.end_at_utc::text AS "end",
      viewer.timezone,s.name AS subject,tu.name AS "tutorName",l.display_name AS "learnerName",
      l.level AS "learnerLevel",requester.name AS "requesterName",l.management AS relationship,
      ARRAY(SELECT g.action FROM public.booking_workflow_grants g
        WHERE g.logical_booking_id=b.logical_booking_id AND g.actor_user_id=${actor.userId}
          AND public.has_booking_workflow_task(${actor.userId},${actor.sessionId},b.id,g.action)
          AND ${currentTutor}
          AND ((g.action='confirm' AND b.state='provisional' AND b.expires_at>statement_timestamp()
            AND b.start_at_utc>statement_timestamp() AND s.is_active
            AND EXISTS(SELECT 1 FROM public.tutor_subjects offering WHERE offering.tutor_id=t.id AND offering.subject_id=s.id AND l.level=ANY(offering.levels)))
            OR (g.action='no_show' AND b.state='confirmed' AND b.end_at_utc<=statement_timestamp()))
        ORDER BY g.action) AS actions
    FROM public.bookings b JOIN public.subjects s ON s.id=b.subject_id
      JOIN public.learner_profiles l ON l.id=b.learner_id
      JOIN public.tutor_profiles t ON t.id=b.tutor_id JOIN public."user" tu ON tu.id=t.user_id
      JOIN public."user" requester ON requester.id=b.booked_by_user_id
      JOIN public."user" viewer ON viewer.id=${actor.userId}
    WHERE ${privateActorPredicate(packet, sql`${actor.userId}`)} AND ${privateBookingPredicate(packet, sql`b.id`)}
      AND public.has_admin_assurance(${actor.userId},${actor.sessionId},28800)
      AND b.booked_by_user_id<>${actor.userId} AND t.user_id<>${actor.userId}
      AND b.source='synthetic_readiness' AND b.workflow_policy_id=${policy.policyId}::uuid
      AND public.booking_workflow_policy_current(b.workflow_policy_id)
      AND public.has_current_booking_beneficiary(b.booked_by_user_id,l.id,b.admission_policy_id)
      AND public.has_current_tutor_screening(t.id,'synthetic_readiness')
      AND EXISTS(SELECT 1 FROM public.booking_workflow_grants g
        WHERE g.logical_booking_id=b.logical_booking_id AND g.actor_user_id=${actor.userId}
          AND public.has_booking_workflow_task(${actor.userId},${actor.sessionId},b.id,g.action))
      ${bookingId ? sql`AND b.id=${bookingId}::uuid` : sql``}
      ${filters.q ? sql`AND b.id=${filters.q}::uuid` : sql``}
      ${filters.state === "all" ? sql`` : sql`AND ${effectiveState}=${filters.state}`}
    ORDER BY b.start_at_utc DESC,b.id DESC
    LIMIT ${bookingId ? 1 : filters.pageSize + 1} OFFSET ${bookingId ? 0 : (filters.page - 1) * filters.pageSize}`);
  assertPrivateWorkflowUnchanged(c.runtime, packet);
  return result.rows.map((row) => ({
    ...row,
    time: formatLessonTime(
      new Date(row.start),
      new Date(row.end),
      row.timezone,
    ),
  }));
}

export async function listStaffBookings(
  c: Context,
  headers: Headers,
  input: unknown = {},
) {
  const filters = staffBookingInput.parse(input);
  const rows = await queryStaffBookings(c, headers, filters);
  return {
    items: rows.slice(0, filters.pageSize),
    page: filters.page,
    pageSize: filters.pageSize,
    hasMore: rows.length > filters.pageSize && filters.page < 1000,
  };
}
export async function readPrivateStaffBooking(
  c: Context,
  headers: Headers,
  bookingId: string,
) {
  if (!z.uuid().safeParse(bookingId).success) throw new AccessError(404);
  const rows = await queryStaffBookings(
    c,
    headers,
    staffBookingInput.parse({}),
    bookingId,
  );
  if (!rows[0]) throw new AccessError(404);
  return rows[0];
}
