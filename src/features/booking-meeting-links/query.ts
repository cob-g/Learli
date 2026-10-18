import {
  privateActorPredicate,
  privateBookingPredicate,
} from "@/features/private-workflow/query";
import type { PrivateWorkflowPacket } from "@/features/private-workflow/config";
// Node-only. The URL projection exists only in this private feature.
import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/connection";
import type { MeetingProvider } from "@/lib/validation/meeting-link";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type MeetingActor = {
  userId: string;
  sessionId: string;
  privateWorkflow?: boolean;
  localWorkflow?: boolean;
  privatePacket?: PrivateWorkflowPacket;
};
export type MeetingSnapshot = {
  source: "local_simulation" | "synthetic_readiness" | "local_operation";
  live: boolean;
  canEdit: boolean;
  now: string;
  url: string | null;
  provider: MeetingProvider | null;
  revision: number | null;
};

/** One fresh statement after all waits is the current authorization point. */
export async function queryPrivateMeeting(
  db: Database | Transaction,
  actor: MeetingActor,
  bookingId: string,
  editing = false,
): Promise<MeetingSnapshot | undefined> {
  const result = await db.execute<MeetingSnapshot>(sql`
    WITH actor AS (
      SELECT u.id, statement_timestamp() AS now FROM "user" u
      JOIN user_access ua ON ua.user_id=u.id AND ua.status='active'
      JOIN session s ON s.user_id=u.id AND s.id=${actor.sessionId}
        AND s.expires_at > statement_timestamp()
      WHERE ${privateActorPredicate(actor.privatePacket, sql`u.id`)} AND u.id=${actor.userId} AND u.email_verified=true
        AND (${actor.localWorkflow === true} OR u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$')
    ), permitted AS (
      SELECT b.id, b.source, a.now,
        ((b.source='local_simulation' AND b.state IN('demo_reserved','demo_confirmed') AND b.expires_at > a.now) OR (b.source IN('synthetic_readiness','local_operation') AND b.state='confirmed' AND b.end_at_utc>a.now AND public.booking_workflow_policy_current(b.workflow_policy_id))) AS live,
        tp.user_id=a.id AND EXISTS (
          SELECT 1 FROM user_roles r WHERE r.user_id=a.id AND r.role='tutor'
        ) AS can_edit
      FROM actor a JOIN bookings b ON b.id=${bookingId}::uuid AND b.source IN('local_simulation','synthetic_readiness','local_operation')
      JOIN tutor_profiles tp ON tp.id=b.tutor_id AND tp.review_status='approved'
      JOIN "user" tu ON tu.id=tp.user_id AND tu.email_verified=true
        AND (b.source='local_operation' OR tu.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$')
      JOIN user_access ta ON ta.user_id=tu.id AND ta.status='active'
      JOIN learner_profiles l ON l.id=b.learner_id AND l.status='active' AND ((b.source='local_simulation' AND l.source='local_fixture') OR (b.source IN('synthetic_readiness','local_operation') AND l.source=b.source AND public.has_current_booking_beneficiary(b.booked_by_user_id,l.id,b.admission_policy_id) AND public.has_current_tutor_screening(tp.id,b.source)))
      WHERE ${actor.localWorkflow === true ? sql`b.source='local_operation'` : sql`b.source<>'local_operation'`} AND public.workflow_identity(a.id,${actor.sessionId},CASE WHEN b.source='local_simulation' THEN 'synthetic_readiness' ELSE b.source END) AND ${privateBookingPredicate(actor.privatePacket, sql`b.id`)} AND ${actor.privateWorkflow ? sql`b.source='synthetic_readiness' AND` : sql``} EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=tu.id AND r.role='tutor')
        AND (
          (tp.user_id=a.id AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=a.id AND r.role='tutor'))
          ${
            editing
              ? sql``
              : sql`OR (b.source IN('synthetic_readiness','local_operation') AND public.has_current_learner_authority(a.id,${actor.sessionId},l.id,b.admission_policy_id)) OR (b.source='local_simulation' AND l.management='self' AND l.user_id=a.id AND l.level='college_support' AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=a.id AND r.role='student'))
          OR (b.source='local_simulation' AND l.management='guardian' AND l.user_id IS NULL AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=a.id AND r.role='parent') AND EXISTS (
            SELECT 1 FROM guardian_learner_links g WHERE g.guardian_user_id=a.id AND g.learner_id=l.id AND g.status='authorized' AND g.source='local_fixture'
          ))`
          }
        )
    ) SELECT p.source, p.live, p.can_edit AS "canEdit", p.now::text AS now,
      m.url, m.provider, m.revision
    FROM permitted p LEFT JOIN booking_meeting_links m ON m.booking_id=p.id AND p.live
  `);
  return result.rows[0];
}
