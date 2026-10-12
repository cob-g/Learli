// Node-only. Dispatcher projection deliberately has no report text or booking join.
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
import { pageInput } from "./input";
import { assignmentInput } from "./dispatch-input";
async function actor(runtime: AuthRuntime, headers: Headers) {
  if (
    !["development", "test"].includes(runtime.environment) ||
    !isLoopbackOrigin(runtime.origin)
  )
    throw new AccessError(503);
  return requireRole(runtime, headers, "admin");
}
function current(identity: Identity) {
  return sql`EXISTS(SELECT 1 FROM session s JOIN "user" u ON u.id=s.user_id JOIN user_access a ON a.user_id=u.id
    WHERE s.id=${identity.sessionId} AND s.user_id=${identity.userId} AND s.expires_at>statement_timestamp() AND u.email_verified
    AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$' AND a.status='active'
    AND EXISTS(SELECT 1 FROM user_roles role WHERE role.user_id=u.id AND role.role='admin'))`;
}
function caseScope(identity: Identity) {
  return sql`c.source='local_synthetic' AND c.requester_user_id<>${identity.userId} AND EXISTS (
    SELECT 1 FROM support_dispatch_grants g WHERE g.case_id=c.id AND g.dispatcher_user_id=${identity.userId} AND g.source='local_fixture' AND g.status='authorized')`;
}
function eligible(id: ReturnType<typeof sql>) {
  return sql`EXISTS(SELECT 1 FROM support_reviewers r JOIN "user" u ON u.id=r.user_id JOIN user_access eligible_access ON eligible_access.user_id=u.id
    WHERE r.user_id=${id} AND r.source='local_fixture' AND r.status='authorized' AND eligible_access.status='active' AND u.email_verified
    AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$' AND EXISTS(SELECT 1 FROM user_roles role WHERE role.user_id=u.id AND role.role='admin'))`;
}
const summarySchema = z.object({
  id: z.uuid(),
  category: z.enum(["general", "account", "safety"]),
  status: z.enum(["open", "in_review", "closed"]),
  revision: z.number().int().nonnegative(),
  assigned: z.boolean(),
  reviewer: z.string().nullable(),
});
const projection = sql`jsonb_build_object('id',c.id,'category',c.category,'status',c.status,'revision',c.revision,
  'assigned',EXISTS(SELECT 1 FROM support_case_assignments a WHERE a.case_id=c.id),
  'reviewer',(SELECT u.name FROM support_case_assignments a JOIN "user" u ON u.id=a.reviewer_user_id WHERE a.case_id=c.id AND ${eligible(sql`a.reviewer_user_id`)}))`;
export async function listDispatchCases(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown = 1,
) {
  const identity = await actor(runtime, headers),
    page = pageInput.parse(input);
  const result = await runtime.db.execute<{
    allowed: boolean;
    cases: unknown;
  }>(sql`
    SELECT ${current(identity)} AS allowed,coalesce((SELECT jsonb_agg(row.item ORDER BY row.id DESC) FROM (
      SELECT c.id,${projection} AS item FROM support_cases c WHERE ${current(identity)} AND ${caseScope(identity)} ORDER BY c.id DESC LIMIT 21 OFFSET ${(page - 1) * 20}
    ) row),'[]'::jsonb) AS cases`);
  if (!result.rows[0]?.allowed) throw new AccessError(403);
  const cases = z.array(summarySchema).parse(result.rows[0].cases);
  return {
    cases: cases.slice(0, 20),
    page,
    hasMore: cases.length > 20 && page < 1000,
  };
}
export async function readDispatchCase(
  runtime: AuthRuntime,
  headers: Headers,
  caseId: string,
  input: unknown = 1,
) {
  const identity = await actor(runtime, headers),
    page = pageInput.parse(input);
  if (!z.uuid().safeParse(caseId).success) throw new AccessError(404);
  const result = await runtime.db.execute<{
    item: unknown;
    choices: unknown;
    history: unknown;
  }>(sql`
    SELECT ${projection} AS item,
      coalesce((SELECT jsonb_agg(row.item ORDER BY row.name,row.id) FROM (
        SELECT choice.reviewer_user_id AS id,u.name,jsonb_build_object('id',choice.reviewer_user_id,'name',u.name) AS item
        FROM support_reviewer_choices choice JOIN "user" u ON u.id=choice.reviewer_user_id
        WHERE choice.case_id=c.id AND choice.source='local_fixture' AND choice.status='authorized' AND ${eligible(sql`choice.reviewer_user_id`)}
        AND choice.reviewer_user_id NOT IN (${identity.userId},c.requester_user_id)
        AND NOT EXISTS(SELECT 1 FROM support_case_assignments a WHERE a.case_id=c.id AND a.reviewer_user_id=choice.reviewer_user_id)
        ORDER BY u.name,choice.reviewer_user_id LIMIT 21
      ) row),'[]'::jsonb) AS choices,
      coalesce((SELECT jsonb_agg(to_jsonb(row) ORDER BY row.revision DESC) FROM (
        SELECT e.kind,e.revision,e.created_at AS "createdAt",CASE WHEN e.actor_user_id=${identity.userId} THEN 'You' ELSE 'Authorized dispatcher fixture' END AS actor
        FROM support_assignment_events e WHERE e.case_id=c.id ORDER BY e.revision DESC LIMIT 21 OFFSET ${(page - 1) * 20}
      ) row),'[]'::jsonb) AS history
    FROM support_cases c WHERE c.id=${caseId}::uuid AND ${current(identity)} AND ${caseScope(identity)}`);
  const row = result.rows[0];
  if (!row) throw new AccessError(404);
  const choices = z
    .array(z.object({ id: z.string(), name: z.string() }))
    .max(20)
    .parse(row.choices);
  const history = z
    .array(
      z.object({
        kind: z.enum(["assign", "reassign", "escalate"]),
        revision: z.number().int(),
        createdAt: z.string(),
        actor: z.enum(["You", "Authorized dispatcher fixture"]),
      }),
    )
    .parse(row.history);
  return {
    ...summarySchema.parse(row.item),
    choices,
    history: history.slice(0, 20),
    page,
    hasMore: history.length > 20 && page < 1000,
  };
}
export type DispatchDetail = Awaited<ReturnType<typeof readDispatchCase>>;
export async function changeAssignment(
  runtime: AuthRuntime,
  headers: Headers,
  caseId: string,
  input: unknown,
) {
  const identity = await actor(runtime, headers);
  if (!z.uuid().safeParse(caseId).success) throw new AccessError(404);
  const values = assignmentInput.parse(input);
  const result = await runtime.db.execute<{
    outcome: string;
    revision: number | null;
  }>(sql`
    SELECT * FROM public.change_local_support_assignment(${identity.userId},${identity.sessionId},${caseId}::uuid,${values.revision},${values.reviewerId},${values.kind},${values.requestKey}::uuid)`);
  const row = result.rows[0];
  if (row?.outcome === "forbidden") throw new AccessError(403);
  if (row?.outcome === "not_found") throw new AccessError(404);
  if (row?.outcome === "invalid")
    throw new RuleError(400, "Choose valid local assignment fields.");
  if (row?.outcome === "conflict")
    throw new RuleError(
      409,
      "This case or request changed. Reload the case before starting another assignment.",
    );
  if (
    !row ||
    !["saved", "replayed"].includes(row.outcome) ||
    row.revision === null
  )
    throw new Error("Local assignment unavailable.");
  return { revision: row.revision, replayed: row.outcome === "replayed" };
}
