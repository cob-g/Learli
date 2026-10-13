import { adminAssurancePredicate } from "@/features/admin-security/assurance";
import type {
  BookingState,
  BookingEvent,
} from "@/features/bookings/lifecycle-model";
// Node-only. Shared current permission predicate, with no private learner projection.
import { sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db/connection";
import type { Identity } from "@/lib/permissions/access";
import { AccessError } from "@/lib/permissions/access";
import { isValidTimeZone } from "@/lib/time/time-zone";
import { formatLessonTime } from "@/features/bookings/format-time";
import type { SupportBookingContext } from "./model";

type Executor = Pick<Database, "execute">;
type Stored = {
  source?: "local_simulation" | "synthetic_readiness";
  tutorName: string;
  subjectName: string;
  state: BookingState;
  start: string;
  end: string;
  events: { event: BookingEvent; at: string }[];
};
function activeAccount(id: SQL) {
  return sql`EXISTS (SELECT 1 FROM "user" p JOIN user_access pa ON pa.user_id=p.id AND pa.status='active'
    WHERE p.id=${id} AND p.email_verified=true AND p.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$')`;
}
function sessionAccess(identity: Identity) {
  return sql`${activeAccount(sql`${identity.userId}`)} AND EXISTS (SELECT 1 FROM session s WHERE s.id=${identity.sessionId} AND s.user_id=${identity.userId} AND s.expires_at>statement_timestamp())`;
}
/** Aliases b/l/tp are deliberately local to this module's queries. */
function participant(id: SQL) {
  return sql`((b.source='synthetic_readiness' AND l.source=b.source AND l.status='active' AND ${activeAccount(id)} AND public.booking_workflow_policy_current(b.workflow_policy_id) AND ((public.has_current_booking_beneficiary(${id},l.id,b.admission_policy_id)) OR (tp.user_id=${id} AND public.has_current_tutor_screening(tp.id,'synthetic_readiness') AND public.has_current_booking_beneficiary(b.booked_by_user_id,l.id,b.admission_policy_id) AND EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=${id} AND r.role='tutor')))) OR (b.source='local_simulation' AND l.source='local_fixture' AND l.status='active' AND ${activeAccount(id)} AND (
    (tp.user_id=${id} AND tp.review_status<>'suspended' AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=${id} AND r.role='tutor')) OR
    (l.management='self' AND l.user_id=${id} AND l.level='college_support' AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=${id} AND r.role='student')) OR
    (l.management='guardian' AND l.user_id IS NULL AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=${id} AND r.role='parent') AND EXISTS (SELECT 1 FROM guardian_learner_links g WHERE g.learner_id=l.id AND g.guardian_user_id=${id} AND g.source='local_fixture' AND g.status='authorized'))
  )))`;
}
const joins = sql`JOIN learner_profiles l ON l.id=b.learner_id JOIN tutor_profiles tp ON tp.id=b.tutor_id JOIN "user" tu ON tu.id=tp.user_id JOIN subjects sub ON sub.id=b.subject_id`;
const projection = sql`jsonb_build_object('source',b.source,'tutorName',tu.name,'subjectName',sub.name,'start',b.start_at_utc,'end',b.end_at_utc,
  'state',CASE WHEN b.state IN('demo_reserved','demo_confirmed') AND b.expires_at<=statement_timestamp() THEN 'demo_expired' WHEN b.state='provisional' AND b.expires_at<=statement_timestamp() THEN 'expired' ELSE b.state END,
  'events',COALESCE((SELECT jsonb_agg(jsonb_build_object('event',e.event,'at',e.created_at) ORDER BY e.created_at,e.id) FROM (SELECT event,created_at,id FROM booking_events WHERE booking_id=b.id UNION ALL SELECT event,created_at,id FROM booking_lifecycle_events WHERE logical_booking_id=b.logical_booking_id AND b.source='synthetic_readiness') e),'[]'::jsonb))`;
function project(item: Stored, timezone: string): SupportBookingContext {
  if (!isValidTimeZone(timezone)) throw new AccessError(503);
  return {
    available: true,
    ...(item.source === "synthetic_readiness" ? { source: item.source } : {}),
    tutorName: item.tutorName,
    subjectName: item.subjectName,
    state: item.state,
    time: formatLessonTime(new Date(item.start), new Date(item.end), timezone),
    events: item.events.map((e) => ({
      event: e.event,
      time: formatLessonTime(new Date(e.at), new Date(e.at), timezone),
    })),
  };
}

export async function queryBookingForReport(
  db: Executor,
  identity: Identity,
  bookingId: string,
) {
  const result = await db.execute<{ item: Stored; timezone: string }>(sql`
    SELECT ${projection} AS item, viewer.timezone FROM bookings b ${joins}
    JOIN "user" viewer ON viewer.id=${identity.userId}
    WHERE b.id=${bookingId}::uuid AND ${sessionAccess(identity)} AND ${participant(sql`${identity.userId}`)}`);
  const row = result.rows[0];
  if (!row) throw new AccessError(404);
  return project(row.item, row.timezone);
}

export async function queryCaseBooking(
  db: Executor,
  identity: Identity,
  caseId: string,
  scope: "requester" | "reviewer",
) {
  const casePermission =
    scope === "requester"
      ? sql`c.requester_user_id=${identity.userId}`
      : sql`${adminAssurancePredicate(identity.userId, identity.sessionId)} AND c.requester_user_id<>${identity.userId} AND EXISTS (
    SELECT 1 FROM support_case_assignments a JOIN support_reviewers r ON r.user_id=a.reviewer_user_id
    JOIN user_roles g ON g.user_id=r.user_id AND g.role='admin'
    WHERE a.case_id=c.id AND a.reviewer_user_id=${identity.userId} AND r.source='local_fixture' AND r.status='authorized')`;
  const result = await db.execute<{
    linked: boolean;
    item: Stored | null;
    timezone: string;
    source: string;
  }>(sql`
    WITH permitted_case AS MATERIALIZED (
      SELECT c.id,c.requester_user_id,c.source,v.timezone FROM support_cases c JOIN "user" v ON v.id=${identity.userId}
      WHERE c.id=${caseId}::uuid AND ${sessionAccess(identity)} AND ((c.source='local_synthetic' AND ${casePermission}) OR (c.source='synthetic_readiness' AND public.has_safeguarding_case_authority(${identity.userId},${identity.sessionId},c.id,${scope})))
    ), context AS MATERIALIZED (
      SELECT c.id AS case_id,b.id AS booking_id,${projection} AS item
      FROM permitted_case c JOIN support_case_bookings link ON link.case_id=c.id JOIN bookings b ON b.id=link.booking_id ${joins}
      WHERE ${participant(sql`c.requester_user_id`)}
    ), audit AS (
      INSERT INTO support_booking_access_events(case_id,booking_id,actor_user_id,action,created_at)
      SELECT case_id,booking_id,${identity.userId},'booking_context_read',statement_timestamp() FROM context WHERE ${scope === "reviewer"}
    ) SELECT c.timezone,c.source,EXISTS(SELECT 1 FROM support_case_bookings link WHERE link.case_id=c.id) AS linked,
      (SELECT item FROM context) AS item FROM permitted_case c`);
  const row = result.rows[0];
  if (!row) throw new AccessError(404);
  if (row.source === "synthetic_readiness") {
    const fresh = await db.execute<{ allowed: boolean; participant: boolean }>(
      sql`SELECT public.has_safeguarding_case_authority(${identity.userId},${identity.sessionId},c.id,${scope}) AS allowed,EXISTS(SELECT 1 FROM public.support_case_bookings link JOIN public.bookings b ON b.id=link.booking_id ${joins} WHERE link.case_id=c.id AND ${participant(sql`c.requester_user_id`)}) AS participant FROM public.support_cases c WHERE c.id=${caseId}::uuid`,
    );
    if (!fresh.rows[0]?.allowed) throw new AccessError(404);
    if (row.linked && !fresh.rows[0].participant)
      return { available: false } as const;
  }
  return !row.linked
    ? undefined
    : row.item
      ? project(row.item, row.timezone)
      : ({ available: false } as const);
}
