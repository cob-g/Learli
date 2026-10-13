import { sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { requireAdminAssurance } from "@/features/admin-security/assurance";
import { requireIdentity, AccessError } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import {
  validateSafeguardingCapability,
  type SafeguardingCapability,
} from "./policy";
import {
  responseInput,
  safeguardingCaseInput,
  safetyRestrictionInput,
} from "./input";
import { screeningOutcome } from "@/features/tutor-screening/service";
export type SafeguardingContext = {
  runtime: AuthRuntime;
  safeguarding: SafeguardingCapability;
};
export function requireSafeguarding(context: SafeguardingContext) {
  const cap = validateSafeguardingCapability(
    context.safeguarding,
    context.runtime.environment,
  );
  if (cap.mode === "disabled") throw new AccessError(503);
  return cap;
}
export async function canIntake(context: SafeguardingContext) {
  const cap = requireSafeguarding(context);
  const r = await context.runtime.db.execute<{ allowed: boolean }>(
    sql`SELECT public.has_current_support_policy(${cap.version}) AND EXISTS(SELECT 1 FROM support_response_policies p WHERE p.provenance='synthetic_readiness' AND p.version=${cap.version} AND 'intake'=ANY(p.allowed_actions)) AS allowed`,
  );
  return r.rows[0]?.allowed === true;
}
export async function createSafeguardingCase(
  context: SafeguardingContext,
  headers: Headers,
  input: unknown,
) {
  const cap = requireSafeguarding(context);
  if (!(await canIntake(context))) throw new AccessError(503);
  const identity = await requireIdentity(context.runtime, headers),
    v = safeguardingCaseInput.parse(input);
  const r = await context.runtime.db.execute<{
    outcome: string;
    case_id: string | null;
  }>(
    sql`SELECT * FROM public.create_safeguarding_case(${identity.userId},${identity.sessionId},${v.requestKey}::uuid,${cap.version},${v.category},${v.subject},${v.body})`,
  );
  const row = r.rows[0];
  if (row?.outcome === "forbidden") throw new AccessError(403);
  if (row?.outcome === "conflict")
    throw new RuleError(
      409,
      "This request already has different fields. Start a new report.",
    );
  if (row?.outcome === "limited")
    throw new RuleError(
      429,
      "The synthetic report limit was reached. Wait before trying again.",
    );
  if (row?.outcome === "invalid")
    throw new RuleError(400, "Check the report fields.");
  if (!row?.case_id || !["saved", "replayed"].includes(row.outcome))
    throw new AccessError(503);
  return { id: row.case_id };
}
export async function changeSafeguardingResponse(
  context: SafeguardingContext,
  headers: Headers,
  caseId: string,
  input: unknown,
) {
  requireSafeguarding(context);
  const identity = await requireAdminAssurance(context.runtime, headers),
    v = responseInput.parse(input);
  z.uuid().parse(caseId);
  const r = await context.runtime.db.execute<{
    outcome: string;
    revision: number | null;
  }>(
    sql`SELECT * FROM public.change_safeguarding_response(${identity.userId},${identity.sessionId},${caseId}::uuid,${v.revision},${v.requestKey}::uuid,${v.action},${v.targetId ?? null})`,
  );
  return screeningOutcome(r.rows[0]);
}
const summary = z.object({
  id: z.uuid(),
  category: z.enum(["general", "account", "safety"]),
  status: z.enum(["open", "in_review", "closed"]),
  revision: z.number().int(),
  acknowledgedAt: z.string().nullable(),
  escalationRequestedAt: z.string().nullable(),
  reviewer: z.string().nullable(),
});
export type SafeguardingScope = "requester" | "reviewer" | "dispatcher";
const projection = sql`jsonb_build_object('id',c.id,'category',c.category,'status',c.status,'revision',c.revision,'acknowledgedAt',resp.acknowledged_at,'escalationRequestedAt',resp.escalation_requested_at,'reviewer',(SELECT u.name FROM support_case_assignments a JOIN "user" u ON u.id=a.reviewer_user_id WHERE a.case_id=c.id))`;
export async function listSafeguardingCases(
  context: SafeguardingContext,
  headers: Headers,
  scope: SafeguardingScope,
) {
  if (scope !== "requester") requireSafeguarding(context);
  const identity =
    scope === "requester"
      ? await requireIdentity(context.runtime, headers)
      : await requireAdminAssurance(context.runtime, headers);
  const r = await context.runtime.db.execute<{ item: unknown }>(
    sql`SELECT ${projection} item FROM support_cases c JOIN support_case_responses resp ON resp.case_id=c.id WHERE public.has_safeguarding_case_authority(${identity.userId},${identity.sessionId},c.id,${scope}) ORDER BY c.created_at DESC,c.id DESC LIMIT 50`,
  );
  return r.rows.map((r) => summary.parse(r.item));
}
export async function readSafeguardingCase(
  context: SafeguardingContext,
  headers: Headers,
  caseId: string,
  scope: SafeguardingScope,
) {
  if (scope !== "requester") requireSafeguarding(context);
  z.uuid().parse(caseId);
  const identity =
    scope === "requester"
      ? await requireIdentity(context.runtime, headers)
      : await requireAdminAssurance(context.runtime, headers);
  return context.runtime.db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT id FROM support_cases WHERE id=${caseId}::uuid AND public.has_safeguarding_case_authority(${identity.userId},${identity.sessionId},id,${scope}) FOR SHARE`,
    );
    // Fresh projection follows any assignment lock wait. Dispatcher SQL never selects content.
    const r = await tx.execute<{
      item: unknown;
      subject?: string;
      body?: string;
      choices: unknown;
      history: unknown;
    }>(
      sql`SELECT ${projection} item,${scope === "dispatcher" ? sql`NULL::text subject,NULL::text body` : sql`c.subject,c.body`},coalesce((SELECT jsonb_agg(jsonb_build_object('id',ch.reviewer_user_id,'name',u.name,'canEscalate',ch.can_escalate)) FROM support_reviewer_choices ch JOIN support_reviewers staff ON staff.user_id=ch.reviewer_user_id JOIN "user" u ON u.id=staff.user_id JOIN user_access a ON a.user_id=u.id JOIN user_roles role ON role.user_id=u.id AND role.role='admin' WHERE ch.case_id=c.id AND ch.source=c.source AND ch.status='authorized' AND ch.valid_until>clock_timestamp() AND staff.source=c.source AND staff.status='authorized' AND staff.valid_until>clock_timestamp() AND u.email_verified AND a.status='active' AND ch.reviewer_user_id NOT IN (${identity.userId},c.requester_user_id)),'[]'::jsonb) choices,coalesce((SELECT jsonb_agg(jsonb_build_object('action',e.action,'revision',e.revision,'createdAt',e.created_at) ORDER BY e.revision) FROM support_response_events e WHERE e.case_id=c.id),'[]'::jsonb) history FROM support_cases c JOIN support_case_responses resp ON resp.case_id=c.id WHERE c.id=${caseId}::uuid AND public.has_safeguarding_case_authority(${identity.userId},${identity.sessionId},c.id,${scope})`,
    );
    const row = r.rows[0];
    if (!row) throw new AccessError(404);
    return {
      ...summary.parse(row.item),
      ...(scope === "dispatcher"
        ? {}
        : {
            subject: z.string().parse(row.subject),
            body: z.string().parse(row.body),
          }),
      choices:
        scope === "requester"
          ? []
          : z
              .array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                  canEscalate: z.boolean(),
                }),
              )
              .max(20)
              .parse(row.choices),
      history: z
        .array(
          z.object({
            action: z.string(),
            revision: z.number(),
            createdAt: z.string(),
          }),
        )
        .parse(row.history),
    };
  });
}
export type SafeguardingDetail = Awaited<
  ReturnType<typeof readSafeguardingCase>
>;
export async function changeSafetyRestriction(
  context: SafeguardingContext,
  headers: Headers,
  targetId: string,
  input: unknown,
) {
  requireSafeguarding(context);
  const identity = await requireAdminAssurance(context.runtime, headers),
    v = safetyRestrictionInput.parse(input);
  z.string().min(1).max(128).parse(targetId);
  const r = await context.runtime.db.execute<{
    outcome: string;
    revision: number | null;
  }>(
    sql`SELECT * FROM public.change_safeguarding_access(${identity.userId},${identity.sessionId},${targetId},${v.revision},${v.action},${v.reason},${v.requestKey}::uuid)`,
  );
  return screeningOutcome(r.rows[0]);
}
export async function readSafetyRestriction(
  context: SafeguardingContext,
  headers: Headers,
  targetId: string,
) {
  const cap = requireSafeguarding(context),
    identity = await requireAdminAssurance(context.runtime, headers);
  z.string().min(1).max(128).parse(targetId);
  const r = await context.runtime.db.execute<{
    name: string;
    status: "active" | "suspended";
    revision: number;
  }>(
    sql`SELECT u.name,a.status,t.revision FROM account_restriction_targets t JOIN "user" u ON u.id=t.user_id JOIN user_access a ON a.user_id=t.user_id JOIN account_restriction_grants g ON g.target_user_id=t.user_id WHERE t.user_id=${targetId} AND t.source='synthetic_readiness' AND g.source=t.source AND g.staff_user_id=${identity.userId} AND g.status='authorized' AND g.valid_until>clock_timestamp() AND t.user_id<>${identity.userId} AND NOT EXISTS(SELECT 1 FROM user_roles role WHERE role.user_id=t.user_id AND role.role='admin') AND public.has_admin_assurance(${identity.userId},${identity.sessionId},28800) AND public.has_current_support_policy(${cap.version})`,
  );
  if (!r.rows[0]) throw new AccessError(404);
  return r.rows[0];
}
