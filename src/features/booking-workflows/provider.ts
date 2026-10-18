// Internal Node-only contracts for W7/W4b. Never expose these functions as a route.
import { sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/connection";
import type { WorkflowEvent, WorkflowState } from "./model";
export function currentCompletionEligibilityPredicate(v: {
  userId: string | SQL;
  sessionId: string | SQL;
  bookingId: string | SQL;
  eventId: string | SQL;
}): SQL {
  return sql`EXISTS(SELECT 1 FROM public.bookings cb JOIN public.booking_lifecycle_events ce ON ce.booking_id=cb.id AND ce.id=${v.eventId}::uuid AND ce.event='workflow_completed' AND ce.workflow_policy_id=cb.workflow_policy_id AND ce.workflow_revision=cb.workflow_revision WHERE cb.id=${v.bookingId}::uuid AND cb.source='synthetic_readiness' AND cb.state='completed' AND cb.end_at_utc<=clock_timestamp() AND NOT EXISTS(SELECT 1 FROM public.bookings head WHERE head.logical_booking_id=cb.logical_booking_id AND head.revision>cb.revision) AND public.has_current_tutor_screening(cb.tutor_id,'synthetic_readiness') AND public.booking_workflow_policy_current(cb.workflow_policy_id) AND public.has_current_learner_authority(${v.userId},${v.sessionId},cb.learner_id,cb.admission_policy_id))`;
}
export type BookingNoticeRecipient = {
  eventId: string;
  source: "synthetic_readiness" | "local_operation";
  recipientUserId: string;
  email: string;
  kind: WorkflowEvent;
  bookingId: string;
  logicalBookingId: string;
  state: WorkflowState;
  startAtUtc: string;
  endAtUtc: string;
  eventAtUtc: string;
  policyVersion: string;
  subjectName: string;
};
/** The authenticated delivery owner passes only committed immutable event IDs on
 * its independent READ COMMITTED connection. Current eligibility is in this SQL,
 * never a cached earlier receipt; logout alone is not beneficiary revocation. */
export async function readCurrentBookingNoticeRecipients(
  db: Pick<Database, "execute">,
  eventId: string,
): Promise<BookingNoticeRecipient[]> {
  const r =
    await db.execute<BookingNoticeRecipient>(sql`SELECT e.id AS "eventId",b.source,i.recipient_user_id AS "recipientUserId",u.email,i.kind,b.id AS "bookingId",b.logical_booking_id AS "logicalBookingId",b.state,b.start_at_utc::text AS "startAtUtc",b.end_at_utc::text AS "endAtUtc",e.created_at::text AS "eventAtUtc",p.version AS "policyVersion",s.name AS "subjectName"
 FROM public.booking_workflow_notice_intents i JOIN public.booking_lifecycle_events e ON e.id=i.event_id JOIN public.bookings b ON b.id=coalesce(e.replacement_booking_id,e.booking_id) JOIN public.booking_workflow_policies p ON p.id=b.workflow_policy_id JOIN public.subjects s ON s.id=b.subject_id JOIN public.tutor_profiles t ON t.id=b.tutor_id JOIN public."user" u ON u.id=i.recipient_user_id JOIN public.user_access a ON a.user_id=u.id AND a.status='active'
 WHERE e.id=${eventId}::uuid AND b.source IN('synthetic_readiness','local_operation') AND e.workflow_policy_id=b.workflow_policy_id AND i.kind=e.event AND u.email_verified AND (b.source='local_operation' OR u.email LIKE '%.test') AND public.booking_workflow_policy_current(b.workflow_policy_id) AND public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id) AND NOT EXISTS(SELECT 1 FROM public.bookings head WHERE head.logical_booking_id=b.logical_booking_id AND head.revision>b.revision)
 AND ((e.event='workflow_provisional' AND b.state='provisional' AND b.expires_at>clock_timestamp()) OR (e.event='workflow_confirmed' AND b.state='confirmed' AND b.end_at_utc>clock_timestamp()) OR (e.event='workflow_rescheduled' AND (b.state='confirmed' OR (b.state='provisional' AND b.expires_at>clock_timestamp())) AND b.end_at_utc>clock_timestamp()) OR (e.event IN('workflow_cancelled','workflow_expired','workflow_completed','workflow_no_show') AND b.state=substring(e.event from 10)))
 AND (i.recipient_user_id=b.booked_by_user_id OR (i.recipient_user_id=t.user_id AND t.review_status='approved' AND public.has_current_tutor_screening(t.id,b.source) AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='tutor')))`);
  return r.rows;
}
