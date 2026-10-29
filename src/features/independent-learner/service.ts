import { sql } from "drizzle-orm";
import type { AuthRuntime } from "@/lib/auth-factory";
import { pgErrorCode } from "@/lib/db/errors";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { canonicalAdmissionSelection } from "@/features/learner-admission/input";
import { readCurrentAuthorizedLearner } from "@/features/learner-admission/authority";
import {
  localIndependentAdmissionPolicy,
  validateAdmissionCapability,
} from "@/features/learner-admission/policy";
import { AccessError, requireIdentity } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import { independentLearnerInput } from "./input";

function independentPolicy(runtime: AuthRuntime) {
  if (!getLocalWorkflow(runtime)) throw new AccessError(503);
  const capability = validateAdmissionCapability(
    localIndependentAdmissionPolicy,
  );
  if (capability.authority === "disabled") throw new AccessError(503);
  return capability;
}

export type IndependentLearnerIntake = {
  enabled: boolean;
  existingLearnerId: string | null;
  policyVersion: string;
  policyDigest: string;
  noticeVersion: string;
  timezone: string;
};

/** Reads only account defaults and exact current authority before collecting profile fields. */
export async function readIndependentLearnerIntake(
  runtime: AuthRuntime,
  headers: Headers,
): Promise<IndependentLearnerIntake> {
  const capability = independentPolicy(runtime);
  const identity = await requireIdentity(runtime, headers);
  const result = await runtime.db.execute<{
    available: boolean;
    existingLearnerId: string | null;
    timezone: string;
  }>(sql`
    SELECT
      public.workflow_identity(${identity.userId},${identity.sessionId},'local_operation')
        AND public.admission_policy_current(${capability.policyId}::uuid)
        AND EXISTS(
          SELECT 1 FROM public.learner_admission_policies p
          WHERE p.id=${capability.policyId}::uuid
            AND p.version=${capability.version}
            AND p.content_digest=${capability.contentDigest}
            AND p.notice_version=${capability.noticeVersion}
        ) AS available,
      (
        SELECT l.id FROM public.learner_profiles l
        JOIN public.learner_admissions a ON a.learner_id=l.id
        WHERE l.user_id=${identity.userId} AND l.management='self'
          AND public.has_current_learner_authority(
            ${identity.userId},${identity.sessionId},l.id,a.policy_id
          )
        ORDER BY l.created_at,l.id LIMIT 1
      ) AS "existingLearnerId",
      u.timezone
    FROM public."user" u
    WHERE u.id=${identity.userId}`);
  const row = result.rows[0];
  if (!row) throw new AccessError(404);
  return {
    enabled: row.available && !row.existingLearnerId,
    existingLearnerId: row.existingLearnerId,
    policyVersion: capability.version,
    policyDigest: capability.contentDigest,
    noticeVersion: capability.noticeVersion,
    timezone: row.timezone,
  };
}

export type IndependentLearnerResult = {
  id: string;
  admissionId: string;
  state: "authorized";
  verificationStatus: "self_attested_unverified";
  replayed: boolean;
};

export async function createIndependentLearner(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown,
): Promise<IndependentLearnerResult> {
  const capability = independentPolicy(runtime);
  const identity = await requireIdentity(runtime, headers);
  const value = independentLearnerInput.parse(input);
  if (
    value.policyVersion !== capability.version ||
    value.policyDigest !== capability.contentDigest ||
    value.noticeVersion !== capability.noticeVersion
  )
    throw new RuleError(
      409,
      "The independent eligibility notice changed. Reload before continuing.",
    );
  const next = canonicalAdmissionSelection(value.next);
  try {
    return await runtime.db.transaction(
      async (tx) => {
        const result = await tx.execute<{
          outcome: string;
          admission_id: string | null;
          learner_id: string | null;
        }>(sql`
          SELECT * FROM public.create_independent_learner(
            ${identity.userId},${identity.sessionId},${value.requestId}::uuid,
            ${capability.policyId}::uuid,${value.noticeVersion},
            ${value.displayName},${value.timezone},${next},
            ${value.eligibilityDeclared}
          )`);
        const row = result.rows[0];
        if (row?.outcome === "forbidden") throw new AccessError(404);
        if (row?.outcome === "policy_unavailable") throw new AccessError(503);
        if (row?.outcome === "invalid")
          throw new RuleError(
            400,
            "Check your profile details and eligibility declaration.",
          );
        if (row && ["conflict", "exists"].includes(row.outcome))
          throw new RuleError(
            409,
            "An independent learner profile already exists or this request changed. Open your account before trying again.",
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
          capability.policyId,
        );
        // Rebind the runtime policy after any database wait and before commit.
        independentPolicy(runtime);
        return {
          id: row.learner_id,
          admissionId: row.admission_id,
          state: "authorized" as const,
          verificationStatus: "self_attested_unverified" as const,
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
