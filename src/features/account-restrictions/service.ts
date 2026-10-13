import { adminAssurancePredicate } from "@/features/admin-security/assurance";
// Node-only domain service; routes import through the server runtime boundary.
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { isLoopbackOrigin } from "@/lib/local-mode";
import {
  AccessError,
  requireRole,
  type Identity,
} from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import { changeInput, pageInput, targetIdInput } from "./input";

async function actor(runtime: AuthRuntime, headers: Headers) {
  if (
    !["development", "test"].includes(runtime.environment) ||
    !isLoopbackOrigin(runtime.origin)
  )
    throw new AccessError(503);
  return requireRole(runtime, headers, "admin");
}
function currentActor(identity: Identity) {
  return sql`${adminAssurancePredicate(identity.userId, identity.sessionId)} AND EXISTS(SELECT 1 FROM session s JOIN "user" u ON u.id=s.user_id JOIN user_access a ON a.user_id=u.id
 WHERE s.id=${identity.sessionId} AND s.user_id=${identity.userId} AND s.expires_at>statement_timestamp()
 AND u.email_verified AND u.email LIKE '%.test' AND a.status='active'
 AND EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='admin'))`;
}
function scope(identity: Identity) {
  return sql`t.source='local_fixture' AND g.staff_user_id=${identity.userId} AND g.status='authorized'
 AND t.user_id<>${identity.userId} AND u.email LIKE '%.test'
 AND NOT EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=t.user_id AND r.role='admin')`;
}
const summarySchema = z.object({
  id: targetIdInput,
  name: z.string(),
  status: z.enum(["active", "suspended"]),
  revision: z.number().int(),
});
const eventSchema = z.object({
  previousStatus: z.enum(["active", "suspended"]),
  nextStatus: z.enum(["active", "suspended"]),
  reason: z.enum([
    "local_access_test",
    "local_review_test",
    "local_restore_test",
  ]),
  revision: z.number().int(),
  createdAt: z.string(),
  actor: z.enum(["You", "Authorized staff fixture"]),
});
export type TargetSummary = z.infer<typeof summarySchema>;
export async function listTargets(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown = 1,
) {
  const identity = await actor(runtime, headers);
  const page = pageInput.parse(input);
  const result = await runtime.db.execute<{
    allowed: boolean;
    targets: unknown;
  }>(sql`
 SELECT ${currentActor(identity)} AS allowed,coalesce((
 SELECT jsonb_agg(to_jsonb(rows) ORDER BY rows.name,rows.id) FROM (
 SELECT t.user_id AS id,u.name,a.status,t.revision FROM account_restriction_targets t
 JOIN account_restriction_grants g ON g.target_user_id=t.user_id JOIN "user" u ON u.id=t.user_id JOIN user_access a ON a.user_id=t.user_id
 WHERE ${currentActor(identity)} AND ${scope(identity)} ORDER BY u.name,t.user_id LIMIT 21 OFFSET ${(page - 1) * 20}
 ) rows),'[]'::jsonb) AS targets`);
  if (!result.rows[0]?.allowed) throw new AccessError(403);
  const rows = z.array(summarySchema).parse(result.rows[0].targets);
  return {
    targets: rows.slice(0, 20),
    page,
    hasMore: rows.length > 20 && page < 1000,
  };
}
export async function readTarget(
  runtime: AuthRuntime,
  headers: Headers,
  targetId: string,
  input: unknown = 1,
) {
  const identity = await actor(runtime, headers);
  if (!targetIdInput.safeParse(targetId).success) throw new AccessError(404);
  const page = pageInput.parse(input);
  const result = await runtime.db.execute<{
    target: unknown;
    history: unknown;
  }>(sql`
 SELECT jsonb_build_object('id',t.user_id,'name',u.name,'status',a.status,'revision',t.revision) AS target,
 coalesce((SELECT jsonb_agg(to_jsonb(rows) ORDER BY rows.revision DESC) FROM (
 SELECT e.previous_status AS "previousStatus",e.next_status AS "nextStatus",e.reason,e.revision,e.created_at AS "createdAt",
 CASE WHEN e.actor_user_id=${identity.userId} THEN 'You' ELSE 'Authorized staff fixture' END AS actor
 FROM account_restriction_events e WHERE e.target_user_id=t.user_id ORDER BY e.revision DESC LIMIT 21 OFFSET ${(page - 1) * 20}
 ) rows),'[]'::jsonb) AS history
 FROM account_restriction_targets t JOIN account_restriction_grants g ON g.target_user_id=t.user_id
 JOIN "user" u ON u.id=t.user_id JOIN user_access a ON a.user_id=t.user_id
 WHERE t.user_id=${targetId} AND ${currentActor(identity)} AND ${scope(identity)}`);
  if (!result.rows[0]) throw new AccessError(404);
  const target = summarySchema.parse(result.rows[0].target),
    history = z.array(eventSchema).parse(result.rows[0].history);
  return {
    ...target,
    history: history.slice(0, 20),
    page,
    hasMore: history.length > 20 && page < 1000,
  };
}
export type TargetDetail = Awaited<ReturnType<typeof readTarget>>;
export async function changeAccess(
  runtime: AuthRuntime,
  headers: Headers,
  targetId: string,
  input: unknown,
) {
  const identity = await actor(runtime, headers);
  if (!targetIdInput.safeParse(targetId).success) throw new AccessError(404);
  const values = changeInput.parse(input);
  const result = await runtime.db.execute<{
    outcome: string;
    revision: number | null;
    status: "active" | "suspended" | null;
  }>(sql`
 SELECT * FROM public.change_local_account_access(${identity.userId},${identity.sessionId},${targetId},${values.revision},${values.status},${values.reason},${values.requestKey}::uuid)`);
  const row = result.rows[0];
  if (row?.outcome === "forbidden") throw new AccessError(403);
  if (row?.outcome === "not_found") throw new AccessError(404);
  if (row?.outcome === "conflict")
    throw new RuleError(
      409,
      "This account or request changed. Reload the account before starting a new action.",
    );
  if (row?.outcome === "invalid")
    throw new RuleError(400, "Choose valid local action fields.");
  if (
    !row ||
    !["saved", "replayed"].includes(row.outcome) ||
    row.status === null ||
    row.revision === null
  )
    throw new Error("Local account action unavailable.");
  return {
    status: row.status,
    revision: row.revision,
    replayed: row.outcome === "replayed",
  };
}
