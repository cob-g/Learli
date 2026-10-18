import {
  privateActorPredicate,
  privateBookingPredicate,
} from "@/features/private-workflow/query";
import type { PrivateWorkflowPacket } from "@/features/private-workflow/config";
// Node-only, internal query. Never import from browser code or consumer features.
import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/connection";
import type { BookingListInput } from "./read-input";
import type { StoredBookingRead } from "./read-projection";
import type { BookingLearnerSummary } from "./read-model";

type ReadActor = {
  userId: string;
  sessionId: string;
  privateWorkflow?: boolean;
  localWorkflow?: boolean;
  privatePacket?: PrivateWorkflowPacket;
};
export type ReadSnapshot = {
  timezone: string;
  snapshot: string;
  items: StoredBookingRead[];
  learners: BookingLearnerSummary[];
  activeItems: StoredBookingRead[];
  historyItems: StoredBookingRead[];
  /** Overview only: earliest expiry over ALL permitted active timed rows, not one page. */
  earliestExpiry?: string | Date | null;
};

/**
 * A single READ COMMITTED statement is the authorization point. No row locks or
 * writes: a waited provider/earlier query can never supply stale grants here.
 * Expiry projection and persisted history use the same DB statement clock.
 */
export async function queryParticipantBookings(
  db: Database,
  actor: ReadActor,
  input: BookingListInput,
  bookingId?: string,
  overview = false,
): Promise<ReadSnapshot | undefined> {
  const role = input.scope === "guardian" ? "parent" : input.scope;
  const relation =
    input.scope === "tutor"
      ? sql`tp.user_id = a.id AND tp.review_status <> 'suspended'`
      : input.scope === "student"
        ? sql`l.management = 'self' AND l.user_id = a.id AND l.level = 'college_support'`
        : sql`l.management = 'guardian' AND l.user_id IS NULL AND EXISTS (
            SELECT 1 FROM guardian_learner_links g
            WHERE g.guardian_user_id = a.id AND g.learner_id = l.id
              AND g.status = 'authorized' AND g.source = 'local_fixture')`;
  const active = sql`(((b.source='local_simulation' AND b.state IN ('demo_reserved','demo_confirmed') AND b.expires_at>a.now) OR (b.source IN('synthetic_readiness','local_operation') AND (b.state='confirmed' OR (b.state='provisional' AND b.expires_at>a.now)))) AND b.end_at_utc>a.now)`;
  const readinessRelation =
    input.scope === "tutor"
      ? sql`tp.user_id=a.id AND public.has_current_booking_beneficiary(b.booked_by_user_id,l.id,b.admission_policy_id) AND public.has_current_tutor_screening(tp.id,b.source)`
      : sql`${input.scope === "student" ? sql`l.management='self' AND l.user_id=a.id AND l.level='college_support'` : sql`l.management='guardian' AND l.user_id IS NULL`} AND public.has_current_learner_authority(a.id,${actor.sessionId},l.id,b.admission_policy_id)`;
  const filter =
    input.filter === "active"
      ? active
      : input.filter === "history"
        ? sql`NOT (${active})`
        : sql`TRUE`;
  const order = input.filter === "active" ? sql`ASC` : sql`DESC`;
  // Keep eligibility in permitted; construct display JSON and correlated lookups
  // only for selected page rows. Expiry still examines the full permitted set.
  const item = sql`jsonb_build_object(
          'id', b.id, 'source', b.source, 'workflowRevision', b.workflow_revision, 'policyVersion', (SELECT p.version FROM booking_workflow_policies p WHERE p.id=b.workflow_policy_id), 'logicalBookingId', b.logical_booking_id, 'revision', b.revision, 'currentHeadId', (SELECT head.id FROM bookings head WHERE head.logical_booking_id=b.logical_booking_id ORDER BY head.revision DESC LIMIT 1), 'tutorName', b.tutor_name, 'tutorSlug', b.tutor_slug,
          'subjectName', b.subject_name, 'subjectSlug', b.subject_slug,
          'learnerId', b.learner_id, 'learnerName', b.learner_name, 'learnerLevel', b.learner_level,
          'state', b.booking_state, 'start', b.start_at_utc, 'end', b.end_at_utc,
          'expires', b.booking_expires_at, 'events', ${bookingId ? sql`COALESCE((SELECT jsonb_agg(jsonb_build_object('id', e.id, 'event', e.event, 'at', e.created_at) ORDER BY e.created_at ASC, CASE e.event WHEN 'demo_reserved' THEN 0 WHEN 'demo_confirmed' THEN 1 WHEN 'demo_completed' THEN 2 ELSE 3 END ASC, e.id ASC) FROM (SELECT e.id,e.event,e.created_at FROM booking_events e JOIN bookings eb ON eb.id=e.booking_id WHERE eb.logical_booking_id=b.logical_booking_id UNION ALL SELECT le.id,le.event,le.created_at FROM booking_lifecycle_events le WHERE le.logical_booking_id=b.logical_booking_id) e), '[]'::jsonb)` : sql`'[]'::jsonb`}
        )`;
  const result = await db.execute<ReadSnapshot>(sql`
    WITH actor AS (
      SELECT u.id, u.timezone, statement_timestamp() AS now
      FROM "user" u
      JOIN user_access ua ON ua.user_id = u.id AND ua.status = 'active'
      JOIN session s ON s.user_id = u.id AND s.id = ${actor.sessionId}
        AND s.expires_at > statement_timestamp()
      WHERE ${privateActorPredicate(actor.privatePacket, sql`u.id`)} AND u.id = ${actor.userId} AND u.email_verified = true
        AND (${actor.localWorkflow === true} OR u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$')
        AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = ${role})
        ${input.scope === "tutor" ? sql`AND EXISTS (SELECT 1 FROM tutor_profiles own WHERE own.user_id = u.id AND own.review_status <> 'suspended')` : sql``}
    ), permitted AS (
      SELECT b.id, b.start_at_utc, ${active} AS active, b.state AS booking_state, b.expires_at AS booking_expires_at,
        b.source, b.workflow_revision, b.workflow_policy_id, b.logical_booking_id, b.revision,
        tu.name AS tutor_name, tp.slug AS tutor_slug, sub.name AS subject_name, sub.slug AS subject_slug,
        l.id AS learner_id, l.display_name AS learner_name, l.level AS learner_level, b.end_at_utc
      FROM actor a JOIN bookings b ON b.source IN ('local_simulation','synthetic_readiness','local_operation')
      JOIN learner_profiles l ON l.id = b.learner_id
        AND l.status = 'active'
      JOIN tutor_profiles tp ON tp.id = b.tutor_id
      JOIN "user" tu ON tu.id = tp.user_id
      JOIN subjects sub ON sub.id = b.subject_id
      WHERE ${actor.localWorkflow === true ? sql`b.source='local_operation'` : sql`b.source<>'local_operation'`} AND public.workflow_identity(a.id,${actor.sessionId},CASE WHEN b.source='local_simulation' THEN 'synthetic_readiness' ELSE b.source END) AND ${privateBookingPredicate(actor.privatePacket, sql`b.id`)} AND ${actor.privateWorkflow ? sql`b.source='synthetic_readiness' AND` : sql``} ((b.source='local_simulation' AND l.source='local_fixture' AND ${relation}) OR (b.source IN('synthetic_readiness','local_operation') AND l.source=b.source AND public.booking_workflow_policy_current(b.workflow_policy_id) AND ${readinessRelation})) AND ${filter}
        ${bookingId ? sql`AND b.id = ${bookingId}::uuid` : sql``}
        ${input.learnerId ? sql`AND l.id = ${input.learnerId}::uuid` : sql``}
    ), paged AS (
      SELECT * FROM permitted ORDER BY start_at_utc ${order}, id ${order}
      LIMIT ${bookingId ? 1 : input.pageSize + 1} OFFSET ${bookingId ? 0 : (input.page - 1) * input.pageSize}
    ), active_paged AS (
      SELECT * FROM permitted WHERE active ORDER BY start_at_utc ASC, id ASC
      LIMIT ${input.pageSize + 1}
    ), history_paged AS (
      SELECT * FROM permitted WHERE NOT active ORDER BY start_at_utc DESC, id DESC
      LIMIT ${input.pageSize + 1} OFFSET ${(input.page - 1) * input.pageSize}
    )
    SELECT a.timezone, a.now::text AS snapshot,
      ${overview ? sql`'[]'::jsonb` : sql`COALESCE((SELECT jsonb_agg(${item} ORDER BY start_at_utc ${order}, id ${order}) FROM paged b), '[]'::jsonb)`} AS items,
      ${overview ? sql`COALESCE((SELECT jsonb_agg(${item} ORDER BY start_at_utc ASC, id ASC) FROM active_paged b), '[]'::jsonb)` : sql`'[]'::jsonb`} AS "activeItems",
      ${overview ? sql`COALESCE((SELECT jsonb_agg(${item} ORDER BY start_at_utc DESC, id DESC) FROM history_paged b), '[]'::jsonb)` : sql`'[]'::jsonb`} AS "historyItems",
      ${overview ? sql`(SELECT MIN(booking_expires_at) FROM permitted WHERE active AND booking_state <> 'confirmed')` : sql`NULL::timestamptz`} AS "earliestExpiry",
      ${
        input.scope === "tutor"
          ? sql`'[]'::jsonb`
          : sql`COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', lp.id, 'displayName', lp.display_name, 'level', lp.level) ORDER BY lp.created_at ASC, lp.id ASC)
        FROM learner_profiles lp WHERE lp.status = 'active' AND ((lp.source=${actor.localWorkflow === true ? "local_operation" : "synthetic_readiness"} AND ${input.scope === "student" ? sql`lp.management='self' AND lp.user_id=a.id AND lp.level='college_support'` : sql`lp.management='guardian' AND lp.user_id IS NULL`} AND EXISTS(SELECT 1 FROM learner_admissions la WHERE la.learner_id=lp.id AND public.has_current_learner_authority(a.id,${actor.sessionId},lp.id,la.policy_id))) OR (${actor.privateWorkflow || actor.localWorkflow ? sql`false` : sql`true`} AND lp.source = 'local_fixture' AND ${input.scope === "student" ? sql`lp.management = 'self' AND lp.user_id = a.id AND lp.level = 'college_support'` : sql`lp.management = 'guardian' AND lp.user_id IS NULL AND EXISTS (SELECT 1 FROM guardian_learner_links gl WHERE gl.learner_id = lp.id AND gl.guardian_user_id = a.id AND gl.status = 'authorized' AND gl.source = 'local_fixture')`}))
      ), '[]'::jsonb)`
      } AS learners
    FROM actor a
  `);
  return result.rows[0];
}
