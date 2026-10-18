import { getLocalWorkflow } from "@/features/local-workflow/runtime";
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
import {
  assertPrivateWorkflowUnchanged,
  getPrivateWorkflow,
  type PrivateWorkflowPacket,
} from "@/features/private-workflow/runtime";
import { privateActorPredicate } from "@/features/private-workflow/query";
import {
  accountRoles,
  changeInput,
  pageInput,
  privateAccountDetailQueryInput,
  privateAccountQueryInput,
  targetIdInput,
  type AccountQuery,
} from "./input";

async function actor(runtime: AuthRuntime, headers: Headers) {
  if (
    !["development", "test"].includes(runtime.environment) ||
    !isLoopbackOrigin(runtime.origin)
  )
    throw new AccessError(503);
  const packet = getPrivateWorkflow(runtime);
  if (packet && packet.database.mode !== "local-test")
    throw new AccessError(503);
  return {
    identity: await requireRole(runtime, headers, "admin"),
    packet,
    local: !!getLocalWorkflow(runtime),
  };
}
function currentActor(
  identity: Identity,
  packet: PrivateWorkflowPacket | null,
  local = false,
) {
  return sql`${adminAssurancePredicate(identity.userId, identity.sessionId)} AND EXISTS(SELECT 1 FROM session s JOIN "user" u ON u.id=s.user_id JOIN user_access a ON a.user_id=u.id
 WHERE s.id=${identity.sessionId} AND s.user_id=${identity.userId} AND s.expires_at>statement_timestamp()
 AND u.email_verified AND (${local} OR u.email LIKE '%.test') AND a.status='active'
 AND EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='admin'))
 AND ${privateActorPredicate(packet, sql`${identity.userId}`)} AND (${!local} OR public.has_local_workflow_staff(${identity.userId},${identity.sessionId},'account'))`;
}
function scope(
  identity: Identity,
  packet: PrivateWorkflowPacket | null,
  local = false,
) {
  return sql`t.source=${local ? "local_operation" : "local_fixture"} AND g.staff_user_id=${identity.userId} AND g.status='authorized'
 AND t.user_id<>${identity.userId} AND (${local} OR u.email LIKE '%.test')
 AND NOT EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=t.user_id AND r.role='admin')
 AND g.source=t.source AND ${packet ? privateActorPredicate(packet, sql`t.user_id`) : sql`true`}`;
}
const roleProjection = sql`coalesce((SELECT jsonb_agg(r.role ORDER BY r.role) FROM user_roles r WHERE r.user_id=t.user_id),'[]'::jsonb)`;
const summarySchema = z.object({
  id: targetIdInput,
  name: z.string(),
  status: z.enum(["active", "suspended"]),
  revision: z.number().int(),
  roles: z.array(z.enum(accountRoles)).optional(),
});
const eventSchema = z.object({
  previousStatus: z.enum(["active", "suspended"]),
  nextStatus: z.enum(["active", "suspended"]),
  reason: z.enum([
    "local_access_test",
    "local_review_test",
    "local_restore_test",
    "local_restrict",
    "local_restore",
  ]),
  revision: z.number().int(),
  createdAt: z.string(),
  actor: z.enum(["You", "Authorized staff fixture", "Authorized staff"]),
});
export type TargetSummary = z.infer<typeof summarySchema>;
function queryInput(input: unknown) {
  return input !== null && typeof input === "object" ? input : { page: input };
}
function filters(query: AccountQuery) {
  return sql`${query.q ? sql`strpos(lower(u.name),lower(${query.q}))>0` : sql`true`}
    AND ${query.role ? sql`EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=t.user_id AND r.role=${query.role})` : sql`true`}
    AND ${query.status ? sql`a.status=${query.status}` : sql`true`}`;
}
async function assertCurrentPrivateTarget(
  db: Pick<AuthRuntime["db"], "execute">,
  identity: Identity,
  packet: PrivateWorkflowPacket,
  targetId: string,
) {
  const current = await db.execute<{ allowed: boolean; visible: boolean }>(sql`
    SELECT ${currentActor(identity, packet)} AS allowed, EXISTS(
      SELECT 1 FROM account_restriction_targets t
      JOIN account_restriction_grants g ON g.target_user_id=t.user_id
      JOIN "user" u ON u.id=t.user_id
      WHERE t.user_id=${targetId} AND ${scope(identity, packet)}
    ) AS visible`);
  if (!current.rows[0]?.allowed) throw new AccessError(403);
  if (!current.rows[0]?.visible) throw new AccessError(404);
}
export async function listTargets(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown = 1,
) {
  const { identity, packet, local } = await actor(runtime, headers);
  const query =
    packet || local ? privateAccountQueryInput.parse(queryInput(input)) : null;
  const page = query?.page ?? pageInput.parse(input),
    pageSize = query?.pageSize ?? 20;
  const result = await runtime.db.execute<{
    allowed: boolean;
    targets: unknown;
  }>(sql`
 SELECT ${currentActor(identity, packet, local)} AS allowed,coalesce((
 SELECT jsonb_agg(to_jsonb(rows) ORDER BY rows.name,rows.id) FROM (
 SELECT t.user_id AS id,u.name,a.status,t.revision${packet || local ? sql`,${roleProjection} AS roles` : sql``} FROM account_restriction_targets t
 JOIN account_restriction_grants g ON g.target_user_id=t.user_id JOIN "user" u ON u.id=t.user_id JOIN user_access a ON a.user_id=t.user_id
 WHERE ${currentActor(identity, packet, local)} AND ${scope(identity, packet, local)} AND ${query ? filters(query) : sql`true`} ORDER BY u.name,t.user_id LIMIT ${pageSize + 1} OFFSET ${(page - 1) * pageSize}
 ) rows),'[]'::jsonb) AS targets`);
  if (!result.rows[0]?.allowed) throw new AccessError(403);
  const rows = z.array(summarySchema).parse(result.rows[0].targets);
  assertPrivateWorkflowUnchanged(runtime, packet);
  return {
    targets: rows.slice(0, pageSize),
    page,
    hasMore: rows.length > pageSize && page < 1000,
    ...(query
      ? { query, privateWorkflow: !!packet, localWorkflow: local }
      : {}),
  };
}
export async function readTarget(
  runtime: AuthRuntime,
  headers: Headers,
  targetId: string,
  input: unknown = 1,
) {
  const { identity, packet, local } = await actor(runtime, headers);
  if (!targetIdInput.safeParse(targetId).success) throw new AccessError(404);
  const query =
    packet || local
      ? privateAccountDetailQueryInput.parse(queryInput(input))
      : null;
  const page = query?.historyPage ?? pageInput.parse(input);
  const result = await runtime.db.execute<{
    target: unknown;
    history: unknown;
  }>(sql`
 SELECT jsonb_build_object('id',t.user_id,'name',u.name,'status',a.status,'revision',t.revision${packet || local ? sql`,'roles',${roleProjection}` : sql``}) AS target,
 coalesce((SELECT jsonb_agg(to_jsonb(rows) ORDER BY rows.revision DESC) FROM (
 SELECT e.previous_status AS "previousStatus",e.next_status AS "nextStatus",e.reason,e.revision,e.created_at AS "createdAt",
 CASE WHEN e.actor_user_id=${identity.userId} THEN 'You' ELSE ${local ? "Authorized staff" : "Authorized staff fixture"} END AS actor
 FROM account_restriction_events e WHERE e.target_user_id=t.user_id ORDER BY e.revision DESC LIMIT 21 OFFSET ${(page - 1) * 20}
 ) rows),'[]'::jsonb) AS history
 FROM account_restriction_targets t JOIN account_restriction_grants g ON g.target_user_id=t.user_id
 JOIN "user" u ON u.id=t.user_id JOIN user_access a ON a.user_id=t.user_id
 WHERE t.user_id=${targetId} AND ${currentActor(identity, packet, local)} AND ${scope(identity, packet, local)}`);
  if (!result.rows[0]) throw new AccessError(404);
  const target = summarySchema.parse(result.rows[0].target),
    history = z.array(eventSchema).parse(result.rows[0].history);
  assertPrivateWorkflowUnchanged(runtime, packet);
  return {
    ...target,
    history: history.slice(0, 20),
    page,
    hasMore: history.length > 20 && page < 1000,
    ...(query
      ? { query, privateWorkflow: !!packet, localWorkflow: local }
      : {}),
  };
}
export type TargetDetail = Awaited<ReturnType<typeof readTarget>>;
export async function changeAccess(
  runtime: AuthRuntime,
  headers: Headers,
  targetId: string,
  input: unknown,
) {
  const { identity, packet } = await actor(runtime, headers);
  if (!targetIdInput.safeParse(targetId).success) throw new AccessError(404);
  const values = changeInput.parse(input);
  return runtime.db.transaction(
    async (tx) => {
      assertPrivateWorkflowUnchanged(runtime, packet);
      if (packet)
        await assertCurrentPrivateTarget(tx, identity, packet, targetId);
      const result = await tx.execute<{
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
      if (packet) {
        // This is a fresh SQL command after the function's domain/grant/event waits.
        // Retaining the transaction ensures denied scope cannot commit status/history.
        await assertCurrentPrivateTarget(tx, identity, packet, targetId);
      }
      assertPrivateWorkflowUnchanged(runtime, packet);
      return {
        status: row.status,
        revision: row.revision,
        replayed: row.outcome === "replayed",
      };
    },
    { isolationLevel: "read committed" },
  );
}
