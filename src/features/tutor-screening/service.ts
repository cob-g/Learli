import {
  getPrivateWorkflow,
  privatePolicyEnvironment,
} from "@/features/private-workflow/runtime";
import { privateActorPredicate } from "@/features/private-workflow/query";
import type { PrivateWorkflowPacket } from "@/features/private-workflow/config";
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { requireAdminAssurance } from "@/features/admin-security/assurance";
import {
  AccessError,
  requireRole,
  type Identity,
} from "@/lib/permissions/access";
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
    privatePolicyEnvironment(context.runtime, "screening", context.screening),
  );
  if (cap.mode === "disabled") throw new AccessError(503);
  return cap;
}
type EnabledScreening = Exclude<ScreeningCapability, { mode: "disabled" }>;
type ScreeningIdentity = Pick<Identity, "userId" | "sessionId">;
function privatePacket(context: ScreeningContext, cap: EnabledScreening) {
  const packet = getPrivateWorkflow(context.runtime);
  if (packet && JSON.stringify(packet.screening) !== JSON.stringify(cap))
    throw new AccessError(503);
  return packet;
}
function unchangedPacket(
  context: ScreeningContext,
  cap: EnabledScreening,
  packet: PrivateWorkflowPacket,
) {
  if (JSON.stringify(privatePacket(context, cap)) !== JSON.stringify(packet))
    throw new AccessError(503);
}
/** Aliases c/p/t are the case, its immutable policy, and the target profile. */
function privateScreeningPredicate(
  packet: PrivateWorkflowPacket | null,
  identity: ScreeningIdentity,
) {
  if (!packet) return sql`true`;
  const p = packet.screening;
  return sql`c.provenance=${p.provenance} AND c.policy_version=${p.version}
    AND EXISTS(SELECT 1 FROM public.tutor_screening_policy_heads h
      WHERE h.provenance=c.provenance AND h.version=c.policy_version AND h.status='enabled')
    AND p.reference=${p.reference} AND p.authority_reference=${p.authorityReference}
    AND p.required_check_codes=ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(p.requiredCheckCodes)}::jsonb))
    AND p.allowed_actions=ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(p.allowedActions)}::jsonb))
    AND p.expiry_rule=${p.expiryRule}
    AND p.valid_from=${p.validFrom}::timestamptz AND p.valid_until=${p.validUntil}::timestamptz
    AND p.valid_from<=clock_timestamp() AND p.valid_until>clock_timestamp()
    AND ${privateActorPredicate(packet, sql`${identity.userId}`)}
    AND ${privateActorPredicate(packet, sql`t.user_id`)}`;
}
function screeningActorPredicate(
  identity: ScreeningIdentity,
  scope: "reviewer" | "owner",
) {
  return scope === "reviewer"
    ? sql`public.has_tutor_screening_authority(${identity.userId},${identity.sessionId},c.tutor_id,c.provenance)`
    : sql`t.user_id=${identity.userId} AND EXISTS(SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id JOIN public.user_access a ON a.user_id=u.id JOIN public.user_roles r ON r.user_id=u.id AND r.role='tutor' WHERE s.id=${identity.sessionId} AND s.user_id=${identity.userId} AND s.expires_at>clock_timestamp() AND u.email_verified AND a.status='active')`;
}
async function mutateScreening(
  context: ScreeningContext,
  cap: EnabledScreening,
  identity: ScreeningIdentity,
  tutorId: string,
  scope: "reviewer" | "owner",
  statement: SQL,
  privateReceipt: SQL = sql`true`,
) {
  const packet = privatePacket(context, cap);
  const execute = async (db: Pick<AuthRuntime["db"], "execute">) => {
    const r = await db.execute<{ outcome: string; revision: number | null }>(
      statement,
    );
    const outcome = screeningOutcome(r.rows[0]);
    if (packet) {
      unchangedPacket(context, cap, packet);
      // Existing function locks remain held. This new statement gets a fresh
      // READ COMMITTED snapshot after any function wait and before commit.
      const bound = await db.execute<{ allowed: boolean }>(sql`SELECT EXISTS(
        SELECT 1 FROM public.tutor_screening_cases c
        JOIN public.tutor_screening_policies p ON p.provenance=c.provenance AND p.version=c.policy_version
        JOIN public.tutor_profiles t ON t.id=c.tutor_id
        WHERE c.tutor_id=${tutorId}::uuid AND ${privateScreeningPredicate(packet, identity)}
          AND ${screeningActorPredicate(identity, scope)} AND ${privateReceipt}) AS allowed`);
      if (bound.rows[0]?.allowed !== true) throw new AccessError(503);
      unchangedPacket(context, cap, packet);
    }
    return outcome;
  };
  return packet
    ? context.runtime.db.transaction(execute, {
        isolationLevel: "read committed",
      })
    : execute(context.runtime.db);
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
  return mutateScreening(
    context,
    cap,
    identity,
    tutorId,
    "owner",
    sql`SELECT * FROM public.request_tutor_screening(${identity.userId},${identity.sessionId},${tutorId}::uuid,${requestKey}::uuid,${cap.version})`,
  );
}
export async function recordScreeningCheck(
  context: ScreeningContext,
  headers: Headers,
  tutorId: string,
  input: unknown,
) {
  const cap = requireScreening(context);
  const identity = await requireAdminAssurance(context.runtime, headers),
    v = screeningCheckInput.parse(input);
  z.uuid().parse(tutorId);
  return mutateScreening(
    context,
    cap,
    identity,
    tutorId,
    "reviewer",
    sql`SELECT * FROM public.record_tutor_screening_check(${identity.userId},${identity.sessionId},${tutorId}::uuid,${v.revision},${v.requestKey}::uuid,${v.code},${v.outcome},${v.reference},${v.checkedAt}::timestamptz,${v.expiresAt}::timestamptz)`,
    sql`EXISTS(SELECT 1 FROM public.tutor_screening_checks receipt WHERE receipt.tutor_id=${tutorId}::uuid AND receipt.actor_user_id=${identity.userId} AND receipt.request_key=${v.requestKey}::uuid AND receipt.provenance=${cap.provenance} AND receipt.policy_version=${cap.version})`,
  );
}
export async function decideScreening(
  context: ScreeningContext,
  headers: Headers,
  tutorId: string,
  input: unknown,
) {
  const cap = requireScreening(context);
  const identity = await requireAdminAssurance(context.runtime, headers),
    v = screeningDecisionInput.parse(input);
  z.uuid().parse(tutorId);
  return mutateScreening(
    context,
    cap,
    identity,
    tutorId,
    "reviewer",
    sql`SELECT * FROM public.decide_tutor_screening(${identity.userId},${identity.sessionId},${tutorId}::uuid,${v.revision},${v.requestKey}::uuid,${v.action})`,
    sql`EXISTS(SELECT 1 FROM public.tutor_screening_decisions receipt WHERE receipt.tutor_id=${tutorId}::uuid AND receipt.actor_user_id=${identity.userId} AND receipt.request_key=${v.requestKey}::uuid AND receipt.provenance=${cap.provenance} AND receipt.policy_version=${cap.version})`,
  );
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
  const packet = getPrivateWorkflow(context.runtime);
  const cap = packet ? requireScreening(context) : null;
  if (packet && cap) privatePacket(context, cap);
  const identity =
    scope === "reviewer"
      ? await requireAdminAssurance(context.runtime, headers)
      : await requireRole(context.runtime, headers, "tutor");
  if (!z.uuid().safeParse(tutorId).success) throw new AccessError(404);
  const r = await context.runtime.db.execute<{ detail: unknown }>(
    sql`SELECT jsonb_build_object('revision',c.revision,'round',c.round,'state',c.state,'requiredCodes',p.required_check_codes,'checks',coalesce((SELECT jsonb_agg(jsonb_build_object('code',ck.check_code,'outcome',ck.outcome,'current',ck.outcome='passed' AND ck.checked_at<=clock_timestamp() AND ck.expires_at>clock_timestamp())) FROM tutor_screening_checks ck WHERE ck.tutor_id=c.tutor_id AND ck.round=c.round AND ck.policy_version=c.policy_version AND NOT EXISTS(SELECT 1 FROM tutor_screening_checks newer WHERE newer.tutor_id=ck.tutor_id AND newer.round=ck.round AND newer.check_code=ck.check_code AND newer.revision>ck.revision)),'[]'::jsonb)) detail FROM tutor_screening_cases c JOIN tutor_screening_policies p ON p.provenance=c.provenance AND p.version=c.policy_version JOIN tutor_profiles t ON t.id=c.tutor_id WHERE c.tutor_id=${tutorId}::uuid AND ${privateScreeningPredicate(packet, identity)} AND ${screeningActorPredicate(identity, scope)}`,
  );
  if (packet && cap) unchangedPacket(context, cap, packet);
  if (!r.rows[0]) return null;
  return detail.parse(r.rows[0].detail);
}
export type ScreeningDetail = z.infer<typeof detail>;
