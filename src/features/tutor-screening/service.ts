import { sql } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { requireAdminAssurance } from "@/features/admin-security/assurance";
import { AccessError, requireRole } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import { screeningCheckInput, screeningDecisionInput } from "./input";
import {
  validateScreeningCapability,
  type ScreeningCapability,
} from "./policy";
export type ScreeningContext = {
  runtime: AuthRuntime;
  screening: ScreeningCapability;
};
export function requireScreening(context: ScreeningContext) {
  const cap = validateScreeningCapability(
    context.screening,
    context.runtime.environment,
  );
  if (cap.mode === "disabled") throw new AccessError(503);
  return cap;
}
export function screeningOutcome(
  row: { outcome: string; revision: number | null } | undefined,
) {
  if (row?.outcome === "forbidden") throw new AccessError(403);
  if (row?.outcome === "not_found") throw new AccessError(404);
  if (row?.outcome === "missing_checks")
    throw new RuleError(
      409,
      "All required checks must have current passed evidence before approval.",
    );
  if (row?.outcome === "conflict")
    throw new RuleError(
      409,
      "This application changed. Reload it before continuing.",
    );
  if (row?.outcome === "invalid")
    throw new RuleError(400, "Check the screening fields and dates.");
  if (
    !row ||
    !["saved", "replayed"].includes(row.outcome) ||
    row.revision === null
  )
    throw new AccessError(503);
  return { revision: row.revision, replayed: row.outcome === "replayed" };
}
export async function requestScreening(
  context: ScreeningContext,
  headers: Headers,
  tutorId: string,
  input: unknown,
) {
  const cap = requireScreening(context),
    identity = await requireRole(context.runtime, headers, "tutor");
  const { requestKey } = z.strictObject({ requestKey: z.uuid() }).parse(input);
  z.uuid().parse(tutorId);
  const r = await context.runtime.db.execute<{
    outcome: string;
    revision: number | null;
  }>(
    sql`SELECT * FROM public.request_tutor_screening(${identity.userId},${identity.sessionId},${tutorId}::uuid,${requestKey}::uuid,${cap.version})`,
  );
  return screeningOutcome(r.rows[0]);
}
export async function recordScreeningCheck(
  context: ScreeningContext,
  headers: Headers,
  tutorId: string,
  input: unknown,
) {
  requireScreening(context);
  const identity = await requireAdminAssurance(context.runtime, headers),
    v = screeningCheckInput.parse(input);
  z.uuid().parse(tutorId);
  const r = await context.runtime.db.execute<{
    outcome: string;
    revision: number | null;
  }>(
    sql`SELECT * FROM public.record_tutor_screening_check(${identity.userId},${identity.sessionId},${tutorId}::uuid,${v.revision},${v.requestKey}::uuid,${v.code},${v.outcome},${v.reference},${v.checkedAt}::timestamptz,${v.expiresAt}::timestamptz)`,
  );
  return screeningOutcome(r.rows[0]);
}
export async function decideScreening(
  context: ScreeningContext,
  headers: Headers,
  tutorId: string,
  input: unknown,
) {
  requireScreening(context);
  const identity = await requireAdminAssurance(context.runtime, headers),
    v = screeningDecisionInput.parse(input);
  z.uuid().parse(tutorId);
  const r = await context.runtime.db.execute<{
    outcome: string;
    revision: number | null;
  }>(
    sql`SELECT * FROM public.decide_tutor_screening(${identity.userId},${identity.sessionId},${tutorId}::uuid,${v.revision},${v.requestKey}::uuid,${v.action})`,
  );
  return screeningOutcome(r.rows[0]);
}
const detail = z.object({
  revision: z.number().int(),
  round: z.number().int(),
  state: z.enum(["pending", "approved", "rejected", "suspended", "revoked"]),
  requiredCodes: z.array(z.string()),
  checks: z.array(
    z.object({ code: z.string(), outcome: z.string(), current: z.boolean() }),
  ),
});
export async function readScreening(
  context: ScreeningContext,
  headers: Headers,
  tutorId: string,
  scope: "reviewer" | "owner" = "reviewer",
) {
  const identity =
    scope === "reviewer"
      ? await requireAdminAssurance(context.runtime, headers)
      : await requireRole(context.runtime, headers, "tutor");
  if (!z.uuid().safeParse(tutorId).success) throw new AccessError(404);
  const r = await context.runtime.db.execute<{ detail: unknown }>(
    sql`SELECT jsonb_build_object('revision',c.revision,'round',c.round,'state',c.state,'requiredCodes',p.required_check_codes,'checks',coalesce((SELECT jsonb_agg(jsonb_build_object('code',ck.check_code,'outcome',ck.outcome,'current',ck.outcome='passed' AND ck.checked_at<=clock_timestamp() AND ck.expires_at>clock_timestamp())) FROM tutor_screening_checks ck WHERE ck.tutor_id=c.tutor_id AND ck.round=c.round AND ck.policy_version=c.policy_version AND NOT EXISTS(SELECT 1 FROM tutor_screening_checks newer WHERE newer.tutor_id=ck.tutor_id AND newer.round=ck.round AND newer.check_code=ck.check_code AND newer.revision>ck.revision)),'[]'::jsonb)) detail FROM tutor_screening_cases c JOIN tutor_screening_policies p ON p.provenance=c.provenance AND p.version=c.policy_version JOIN tutor_profiles t ON t.id=c.tutor_id WHERE c.tutor_id=${tutorId}::uuid AND ${scope === "reviewer" ? sql`public.has_tutor_screening_authority(${identity.userId},${identity.sessionId},c.tutor_id,c.provenance)` : sql`t.user_id=${identity.userId} AND EXISTS(SELECT 1 FROM session s JOIN "user" u ON u.id=s.user_id JOIN user_access a ON a.user_id=u.id JOIN user_roles r ON r.user_id=u.id AND r.role='tutor' WHERE s.id=${identity.sessionId} AND s.user_id=${identity.userId} AND s.expires_at>clock_timestamp() AND u.email_verified AND a.status='active')`}`,
  );
  if (!r.rows[0]) return null;
  return detail.parse(r.rows[0].detail);
}
export type ScreeningDetail = z.infer<typeof detail>;
