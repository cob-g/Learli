// Owner-only fixture authority; never imported by a runtime route or page.
import { sql } from "drizzle-orm";
import type { createDatabase } from "@/lib/db/connection";
import { syntheticEmail } from "@/lib/local-mode";
import { targetIdInput } from "./input";
type Owner = ReturnType<typeof createDatabase>;
type Tx = Parameters<Parameters<Owner["db"]["transaction"]>[0]>[0];
function trusted(owner: Owner) {
  if (
    owner.pool.options.user !== "learli_owner" ||
    owner.pool.options.host !== "127.0.0.1" ||
    !["learli_dev", "learli_test"].includes(String(owner.pool.options.database))
  )
    throw new Error("Use isolated local owner tooling.");
}
async function account(tx: Tx, id: string, staff: boolean) {
  targetIdInput.parse(id);
  const result = await tx.execute<{
    email: string;
    verified: boolean;
    status: string;
    admin: boolean;
  }>(sql`
 SELECT u.email,u.email_verified AS verified,a.status,EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='admin') AS admin
 FROM "user" u JOIN user_access a ON a.user_id=u.id WHERE u.id=${id}`);
  const row = result.rows[0];
  if (
    !row ||
    !syntheticEmail(row.email) ||
    row.admin !== staff ||
    (staff && (!row.verified || row.status !== "active"))
  )
    throw new Error(
      "Use an eligible synthetic staff or non-admin target fixture.",
    );
}
export async function provisionRestrictionTarget(
  owner: Owner,
  targetId: string,
) {
  trusted(owner);
  return owner.db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`restriction-target:${targetId}`},0))`,
    );
    await account(tx, targetId, false);
    await tx.execute(
      sql`INSERT INTO account_restriction_targets(user_id,source) VALUES(${targetId},'local_fixture') ON CONFLICT(user_id) DO NOTHING`,
    );
  });
}
export async function authorizeRestrictionTarget(
  owner: Owner,
  staffId: string,
  targetId: string,
) {
  trusted(owner);
  if (staffId === targetId) throw new Error("Self authority is unavailable.");
  return owner.db.transaction(async (tx) => {
    const target = await tx.execute(
      sql`SELECT user_id FROM account_restriction_targets WHERE user_id=${targetId} AND source='local_fixture' FOR UPDATE`,
    );
    if (!target.rowCount)
      throw new Error("Provision the target fixture first.");
    await account(tx, staffId, true);
    await account(tx, targetId, false);
    const existing = await tx.execute<{ status: string }>(
      sql`SELECT status FROM account_restriction_grants WHERE staff_user_id=${staffId} AND target_user_id=${targetId}`,
    );
    if (existing.rows[0]) {
      if (existing.rows[0].status !== "authorized")
        throw new Error("Existing revoked grant preserved.");
      return;
    }
    await tx.execute(
      sql`INSERT INTO account_restriction_grants(staff_user_id,target_user_id,status) VALUES(${staffId},${targetId},'authorized')`,
    );
    await tx.execute(
      sql`INSERT INTO account_restriction_grant_events(staff_user_id,target_user_id,action) VALUES(${staffId},${targetId},'authorized')`,
    );
  });
}
export async function revokeRestrictionTarget(
  owner: Owner,
  staffId: string,
  targetId: string,
) {
  trusted(owner);
  targetIdInput.parse(staffId);
  targetIdInput.parse(targetId);
  return owner.db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT user_id FROM account_restriction_targets WHERE user_id=${targetId} FOR UPDATE`,
    );
    const result = await tx.execute(
      sql`UPDATE account_restriction_grants SET status='revoked',updated_at=clock_timestamp() WHERE staff_user_id=${staffId} AND target_user_id=${targetId} AND status='authorized' RETURNING target_user_id`,
    );
    if (result.rowCount)
      await tx.execute(
        sql`INSERT INTO account_restriction_grant_events(staff_user_id,target_user_id,action) VALUES(${staffId},${targetId},'revoked')`,
      );
  });
}
