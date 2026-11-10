// Server-side SQL shared by participant reads and stream authorization.
import { sql } from "drizzle-orm";
import type { PrivateWorkflowPacket } from "@/features/private-workflow/config";
import { privateActorPredicate } from "@/features/private-workflow/query";
import type { BookingReadScope } from "./read-model";

export type BookingReadActor = {
  userId: string;
  sessionId: string;
  privateWorkflow?: boolean;
  localWorkflow?: boolean;
  privatePacket?: PrivateWorkflowPacket;
};

/** Current provider session, account and role in the final statement snapshot. */
export function participantReadActor(
  actor: BookingReadActor,
  scope: BookingReadScope,
) {
  const role = scope === "guardian" ? "parent" : scope;
  return sql`SELECT u.id, u.timezone, statement_timestamp() AS now
      FROM "user" u
      JOIN user_access ua ON ua.user_id = u.id AND ua.status = 'active'
      JOIN session s ON s.user_id = u.id AND s.id = ${actor.sessionId}
        AND s.expires_at > statement_timestamp()
      WHERE ${privateActorPredicate(actor.privatePacket, sql`u.id`)} AND u.id = ${actor.userId} AND u.email_verified = true
        AND (${actor.localWorkflow === true} OR u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$')
        AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = ${role})
        ${scope === "tutor" ? sql`AND EXISTS (SELECT 1 FROM tutor_profiles own WHERE own.user_id = u.id AND own.review_status <> 'suspended')` : sql``}`;
}

/** Aliases a/lp intentionally match both callers; never scans booking history. */
export function participantLearnerAuthority(
  actor: BookingReadActor,
  scope: "student" | "guardian",
) {
  return sql`lp.status = 'active' AND ((lp.source=${actor.localWorkflow === true ? "local_operation" : "synthetic_readiness"} AND ${scope === "student" ? sql`lp.management='self' AND lp.user_id=a.id AND lp.level='college_support'` : sql`lp.management='guardian' AND lp.user_id IS NULL`} AND EXISTS(SELECT 1 FROM learner_admissions la WHERE la.learner_id=lp.id AND public.has_current_learner_authority(a.id,${actor.sessionId},lp.id,la.policy_id))) OR (${actor.privateWorkflow || actor.localWorkflow ? sql`false` : sql`true`} AND lp.source = 'local_fixture' AND ${scope === "student" ? sql`lp.management = 'self' AND lp.user_id = a.id AND lp.level = 'college_support'` : sql`lp.management = 'guardian' AND lp.user_id IS NULL AND EXISTS (SELECT 1 FROM guardian_learner_links gl WHERE gl.learner_id = lp.id AND gl.guardian_user_id = a.id AND gl.status = 'authorized' AND gl.source = 'local_fixture')`}))`;
}
