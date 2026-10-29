import { sql } from "drizzle-orm";
import type { AuthRuntime } from "@/lib/auth-factory";
import { AccessError, requireRole } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import { pgErrorCode } from "@/lib/db/errors";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { canonicalAdmissionSelection } from "@/features/learner-admission/input";
import { readCurrentAuthorizedLearner } from "@/features/learner-admission/authority";
import {
  localGuardianAdmissionPolicy,
  validateAdmissionCapability,
} from "@/features/learner-admission/policy";
import { parentChildInput } from "./input";

function guardianPolicy(runtime: AuthRuntime) {
  if (!getLocalWorkflow(runtime)) throw new AccessError(503);
  const cap = validateAdmissionCapability(localGuardianAdmissionPolicy);
  if (cap.authority === "disabled") throw new AccessError(503);
  return cap;
}

/** Capability and identity are checked before a page or handler collects child fields. */
export async function readParentChildIntake(
  runtime: AuthRuntime,
  headers: Headers,
) {
  const cap = guardianPolicy(runtime);
  const identity = await requireRole(runtime, headers, "parent");
  const result = await runtime.db.execute<{ timezone: string }>(sql`
    SELECT u.timezone FROM public."user" u
    WHERE u.id=${identity.userId}
      AND public.workflow_identity(${identity.userId},${identity.sessionId},'local_operation')
      AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='parent')
      AND public.admission_policy_current(${cap.policyId}::uuid)
      AND EXISTS(SELECT 1 FROM public.learner_admission_policies p WHERE p.id=${cap.policyId}::uuid
        AND p.version=${cap.version} AND p.content_digest=${cap.contentDigest}
        AND p.notice_version=${cap.noticeVersion})`);
  if (!result.rows[0]) return { enabled: false as const };
  return {
    enabled: true as const,
    policyVersion: cap.version,
    policyDigest: cap.contentDigest,
    noticeVersion: cap.noticeVersion,
    timezone: result.rows[0].timezone,
  };
}

export type ParentChildResult = {
  id: string;
  admissionId: string;
  state: "authorized";
  replayed: boolean;
};

export async function createParentChild(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown,
): Promise<ParentChildResult> {
  const cap = guardianPolicy(runtime);
  const identity = await requireRole(runtime, headers, "parent");
  const value = parentChildInput.parse(input);
  if (
    value.policyVersion !== cap.version ||
    value.policyDigest !== cap.contentDigest ||
    value.noticeVersion !== cap.noticeVersion
  )
    throw new RuleError(
      409,
      "The guardian notice changed. Reload Add Child before saving.",
    );
  const next = canonicalAdmissionSelection(value.next);
  try {
    return await runtime.db.transaction(
      async (tx) => {
        const result = await tx.execute<{
          outcome: string;
          admission_id: string | null;
          learner_id: string | null;
          revision: number;
        }>(
          sql`SELECT * FROM public.create_parent_child(${identity.userId},${identity.sessionId},${value.requestId}::uuid,${cap.policyId}::uuid,${value.noticeVersion},${value.displayName},${value.level},${value.grade ?? null}::integer,${value.timezone},${next},${value.guardianConfirmed},${value.consentConfirmed})`,
        );
        const row = result.rows[0];
        if (row?.outcome === "forbidden") throw new AccessError(404);
        if (row?.outcome === "policy_unavailable") throw new AccessError(503);
        if (row?.outcome === "invalid")
          throw new RuleError(
            400,
            "Check the child details and both confirmations.",
          );
        if (row && ["conflict", "capacity"].includes(row.outcome))
          throw new RuleError(
            409,
            "This request cannot create another child profile. Check My Children before starting a new request.",
          );
        if (
          !row?.learner_id ||
          !row.admission_id ||
          !["created", "replayed"].includes(row.outcome)
        )
          throw new AccessError(503);
        await readCurrentAuthorizedLearner(
          tx,
          identity,
          row.learner_id,
          cap.policyId,
        );
        // Rebind the runtime after any database wait, before committing the receipt.
        guardianPolicy(runtime);
        return {
          id: row.learner_id,
          admissionId: row.admission_id,
          state: "authorized" as const,
          replayed: row.outcome === "replayed",
        };
      },
      { isolationLevel: "read committed" },
    );
  } catch (error) {
    if (pgErrorCode(error) === "42501") throw new AccessError(404);
    throw error;
  }
}
