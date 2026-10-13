// Separate owner-only fixture functions; no runtime policy or staff provisioning endpoint.
import { sql } from "drizzle-orm";
import {
  requireFixtureOwner,
  type FixtureOwner,
} from "@/features/tutor-screening/fixture-tooling";
import { safeguardingPolicyInput, type SafeguardingCapability } from "./policy";
export async function provisionResponseStaff(
  owner: FixtureOwner,
  userId: string,
  validUntil: Date,
  status: "authorized" | "revoked" = "authorized",
) {
  requireFixtureOwner(owner, true);
  return owner.db.transaction(async (tx) => {
    const prior = await tx.execute<{ source: string }>(
      sql`SELECT source FROM support_reviewers WHERE user_id=${userId} FOR UPDATE`,
    );
    if (prior.rows[0] && prior.rows[0].source !== "synthetic_readiness")
      throw new Error("Source collision.");
    const r = await tx.execute<{ allowed: boolean }>(
      sql`SELECT EXISTS(SELECT 1 FROM "user" u JOIN user_access a ON a.user_id=u.id JOIN user_roles g ON g.user_id=u.id AND g.role='admin' WHERE u.id=${userId} AND u.email_verified AND a.status='active' AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$') allowed`,
    );
    if (!r.rows[0]?.allowed)
      throw new Error(
        "Synthetic staff must be active verified administrators.",
      );
    await tx.execute(
      sql`INSERT INTO support_reviewers(user_id,source,status,valid_until) VALUES(${userId},'synthetic_readiness',${status},${validUntil.toISOString()}::timestamptz) ON CONFLICT(user_id) DO UPDATE SET status=excluded.status,valid_until=excluded.valid_until`,
    );
    await tx.execute(
      sql`INSERT INTO support_reviewer_events(reviewer_user_id,action,valid_until,tooling_actor_id) VALUES(${userId},${status},${validUntil.toISOString()}::timestamptz,${userId})`,
    );
  });
}
export async function provisionResponsePolicy(
  owner: FixtureOwner,
  input: SafeguardingCapability,
) {
  requireFixtureOwner(owner, true);
  const p = safeguardingPolicyInput.parse(input);
  return owner.db.transaction(async (tx) => {
    await tx.execute(
      sql`INSERT INTO support_response_policies(provenance,version,reference,valid_from,valid_until,responsible_owner_id,escalation_owner_id,reporting_guidance_reference,meeting_guidance_reference,allowed_actions,reason_codes) VALUES(${p.provenance},${p.version},${p.reference},${p.validFrom}::timestamptz,${p.validUntil}::timestamptz,${p.responsibleOwnerId},${p.escalationOwnerId},${p.reportingGuidanceReference},${p.meetingGuidanceReference},ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(p.allowedActions)}::jsonb)),ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(p.reasonCodes)}::jsonb)))`,
    );
    await tx.execute(
      sql`INSERT INTO support_response_policy_heads(provenance,version,status) VALUES(${p.provenance},${p.version},'enabled') ON CONFLICT(provenance) DO UPDATE SET version=excluded.version,status=excluded.status`,
    );
  });
}
export async function provisionResponseGrant(
  owner: FixtureOwner,
  caseId: string,
  userId: string,
  kind: "dispatcher" | "reviewer_choice",
  validUntil: Date,
  status: "authorized" | "revoked" = "authorized",
  canEscalate = false,
) {
  requireFixtureOwner(owner, true);
  return owner.db.transaction(async (tx) => {
    const c = await tx.execute<{ source: string; requester_user_id: string }>(
      sql`SELECT source,requester_user_id FROM support_cases WHERE id=${caseId}::uuid FOR UPDATE`,
    );
    if (
      c.rows[0]?.source !== "synthetic_readiness" ||
      c.rows[0].requester_user_id === userId
    )
      throw new Error("Unavailable readiness case.");
    const person = await tx.execute<{ allowed: boolean }>(
      sql`SELECT EXISTS(SELECT 1 FROM "user" u JOIN user_access a ON a.user_id=u.id JOIN user_roles g ON g.user_id=u.id AND g.role='admin' WHERE u.id=${userId} AND u.email_verified AND a.status='active' AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$') allowed`,
    );
    if (!person.rows[0]?.allowed)
      throw new Error("Unavailable synthetic administrator.");
    if (kind === "dispatcher")
      await tx.execute(
        sql`INSERT INTO support_dispatch_grants(dispatcher_user_id,case_id,source,status,valid_until) VALUES(${userId},${caseId}::uuid,'synthetic_readiness',${status},${validUntil.toISOString()}::timestamptz) ON CONFLICT(dispatcher_user_id,case_id) DO UPDATE SET status=excluded.status,valid_until=excluded.valid_until,updated_at=clock_timestamp()`,
      );
    else {
      const count = await tx.execute<{ n: number }>(
        sql`SELECT count(*)::int n FROM support_reviewer_choices WHERE case_id=${caseId}::uuid AND reviewer_user_id<>${userId}`,
      );
      if (count.rows[0].n >= 20)
        throw new Error("Exact choice bound exceeded.");
      await tx.execute(
        sql`INSERT INTO support_reviewer_choices(reviewer_user_id,case_id,source,status,valid_until,can_escalate) VALUES(${userId},${caseId}::uuid,'synthetic_readiness',${status},${validUntil.toISOString()}::timestamptz,${canEscalate}) ON CONFLICT(case_id,reviewer_user_id) DO UPDATE SET status=excluded.status,valid_until=excluded.valid_until,can_escalate=excluded.can_escalate,updated_at=clock_timestamp()`,
      );
    }
    await tx.execute(
      sql`INSERT INTO support_dispatch_grant_events(case_id,user_id,kind,action,valid_until,can_escalate,tooling_actor_id) VALUES(${caseId}::uuid,${userId},${kind},${status},${validUntil.toISOString()}::timestamptz,${canEscalate},${userId})`,
    );
  });
}
export async function provisionSafetyRestriction(
  owner: FixtureOwner,
  staffId: string,
  targetId: string,
  validUntil: Date,
  status: "authorized" | "revoked" = "authorized",
  actions: ("restrict" | "restore")[] = ["restrict", "restore"],
) {
  requireFixtureOwner(owner, true);
  return owner.db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT id FROM tutor_profiles WHERE user_id=${targetId} FOR UPDATE`,
    );
    const person = await tx.execute<{ allowed: boolean }>(
      sql`SELECT ${staffId}<>${targetId} AND EXISTS(SELECT 1 FROM "user" u JOIN user_roles g ON g.user_id=u.id AND g.role='admin' JOIN user_access a ON a.user_id=u.id AND a.status='active' WHERE u.id=${staffId} AND u.email_verified AND u.email LIKE '%.test') AND EXISTS(SELECT 1 FROM "user" u WHERE u.id=${targetId} AND u.email LIKE '%.test' AND NOT EXISTS(SELECT 1 FROM user_roles g WHERE g.user_id=u.id AND g.role='admin')) allowed`,
    );
    if (!person.rows[0]?.allowed)
      throw new Error("Unavailable exact synthetic target.");
    const prior = await tx.execute<{ source: string }>(
      sql`SELECT source FROM account_restriction_targets WHERE user_id=${targetId} FOR UPDATE`,
    );
    if (prior.rows[0] && prior.rows[0].source !== "synthetic_readiness")
      throw new Error("Source collision.");
    await tx.execute(
      sql`INSERT INTO account_restriction_targets(user_id,source) VALUES(${targetId},'synthetic_readiness') ON CONFLICT(user_id) DO NOTHING`,
    );
    await tx.execute(
      sql`INSERT INTO account_restriction_grants(staff_user_id,target_user_id,source,status,valid_until,permitted_actions) VALUES(${staffId},${targetId},'synthetic_readiness',${status},${validUntil.toISOString()}::timestamptz,ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(actions)}::jsonb))) ON CONFLICT(staff_user_id,target_user_id) DO UPDATE SET status=excluded.status,valid_until=excluded.valid_until,permitted_actions=excluded.permitted_actions,updated_at=clock_timestamp()`,
    );
    await tx.execute(
      sql`INSERT INTO account_restriction_grant_events(staff_user_id,target_user_id,action,valid_until,permitted_actions,tooling_actor_id) VALUES(${staffId},${targetId},${status},${validUntil.toISOString()}::timestamptz,ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(actions)}::jsonb)),${staffId})`,
    );
  });
}
