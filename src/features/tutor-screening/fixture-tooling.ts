// Deliberate owner-only fictional provisioning. Runtime pages never import this module.
import { sql } from "drizzle-orm";
import type { createDatabase } from "@/lib/db/connection";
import { screeningPolicyInput, type ScreeningCapability } from "./policy";
export type FixtureOwner = ReturnType<typeof createDatabase>;
export function requireFixtureOwner(owner: FixtureOwner, readiness = false) {
  if (
    owner.pool.options.user !== "learli_owner" ||
    owner.pool.options.host !== "127.0.0.1" ||
    !(readiness ? ["learli_test"] : ["learli_dev", "learli_test"]).includes(
      String(owner.pool.options.database),
    )
  )
    throw new Error("Use an owned synthetic local database.");
}
export async function provisionScreeningPolicy(
  owner: FixtureOwner,
  input: ScreeningCapability,
) {
  requireFixtureOwner(owner, true);
  const p = screeningPolicyInput.parse(input);
  return owner.db.transaction(async (tx) => {
    await tx.execute(
      sql`INSERT INTO tutor_screening_policies(provenance,version,reference,authority_reference,required_check_codes,allowed_actions,expiry_rule,valid_from,valid_until) VALUES(${p.provenance},${p.version},${p.reference},${p.authorityReference},ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(p.requiredCheckCodes)}::jsonb)),ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(p.allowedActions)}::jsonb)),${p.expiryRule},${p.validFrom}::timestamptz,${p.validUntil}::timestamptz)`,
    );
  });
}
export async function selectScreeningPolicy(
  owner: FixtureOwner,
  version: string,
  status: "enabled" | "revoked" = "enabled",
) {
  requireFixtureOwner(owner, true);
  await owner.db.execute(
    sql`INSERT INTO tutor_screening_policy_heads(provenance,version,status) VALUES('synthetic_readiness',${version},${status}) ON CONFLICT(provenance) DO UPDATE SET version=excluded.version,status=excluded.status`,
  );
}
export async function provisionScreeningAssignment(
  owner: FixtureOwner,
  tutorId: string,
  reviewerId: string,
  provenance: "local_fixture" | "synthetic_readiness",
  validUntil: Date,
  status: "authorized" | "revoked" = "authorized",
) {
  requireFixtureOwner(owner, provenance === "synthetic_readiness");
  if (!Number.isFinite(validUntil.getTime()))
    throw new Error("Explicit finite expiry required.");
  return owner.db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT id FROM tutor_profiles WHERE id=${tutorId}::uuid FOR UPDATE`,
    );
    const check = await tx.execute<{ allowed: boolean }>(
      sql`SELECT EXISTS(SELECT 1 FROM "user" u JOIN user_access a ON a.user_id=u.id JOIN user_roles g ON g.user_id=u.id AND g.role='admin' JOIN tutor_profiles t ON t.id=${tutorId}::uuid WHERE u.id=${reviewerId} AND u.email_verified AND a.status='active' AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$' AND u.id<>t.user_id) allowed`,
    );
    if (!check.rows[0]?.allowed)
      throw new Error(
        "Use a distinct verified active synthetic administrator.",
      );
    const prior = await tx.execute<{
      provenance: string;
      assignment_revision: number;
    }>(
      sql`SELECT provenance,assignment_revision FROM tutor_screening_assignments WHERE tutor_id=${tutorId}::uuid FOR UPDATE`,
    );
    if (prior.rows[0] && prior.rows[0].provenance !== provenance)
      throw new Error("Assignment provenance cannot change.");
    await tx.execute(
      sql`INSERT INTO tutor_screening_staff(user_id,provenance,status,valid_until) VALUES(${reviewerId},${provenance},${status},${validUntil.toISOString()}::timestamptz) ON CONFLICT(user_id,provenance) DO UPDATE SET status=excluded.status,valid_until=excluded.valid_until`,
    );
    const revision = (prior.rows[0]?.assignment_revision ?? -1) + 1;
    await tx.execute(
      sql`INSERT INTO tutor_screening_assignments(tutor_id,reviewer_user_id,provenance,status,assignment_revision) VALUES(${tutorId}::uuid,${reviewerId},${provenance},${status},${revision}) ON CONFLICT(tutor_id) DO UPDATE SET reviewer_user_id=excluded.reviewer_user_id,status=excluded.status,assignment_revision=excluded.assignment_revision,updated_at=clock_timestamp()`,
    );
    await tx.execute(
      sql`INSERT INTO tutor_screening_events(tutor_id,kind,actor_user_id,assignment_revision) VALUES(${tutorId}::uuid,${status === "authorized" ? "assignment" : "revocation"},${reviewerId},${revision})`,
    );
  });
}
