import {
  isPrivateWorkflow,
  privatePolicyEnvironment,
} from "@/features/private-workflow/runtime";
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import type { Database } from "@/lib/db/connection";
import {
  AccessError,
  requireIdentity,
  type Identity,
} from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import { isLoopbackOrigin } from "@/lib/local-mode";
import {
  adminAssurancePredicate,
  requireAdminAssurance,
} from "@/features/admin-security/assurance";
import {
  currentLearnerAuthorityPredicate,
  readCurrentAuthorizedLearner,
} from "./authority";
import {
  admissionInput,
  admissionListCursor,
  admittedLearnerInput,
  canonicalAdmissionSelection,
  evidenceInput,
  reviewInput,
  revokeEvidenceInput,
} from "./input";
import {
  type AdmissionCapability,
  type EnabledAdmissionCapability,
  validateAdmissionCapability,
} from "./policy";
import type { AdmissionState } from "@/lib/db/schema/learner-admission";
import type { PrivateLearner } from "@/features/learners/service";
export type AdmissionContext = {
  runtime: AuthRuntime;
  admission: AdmissionCapability;
};
export type AdmissionSummary = {
  id: string;
  management: "guardian" | "self";
  state: AdmissionState;
  revision: number;
  policyVersion: string;
  createdAt: Date;
};
export type AdmissionDetail = AdmissionSummary & {
  learner: PrivateLearner;
  next: string | null;
  currentAccess: boolean;
};
export type ReviewerAdmissionDetail = AdmissionDetail & {
  evidence: {
    id: string;
    checkCode: string;
    reference: string;
    revoked: boolean;
  }[];
};
function capability(context: AdmissionContext): EnabledAdmissionCapability {
  privatePolicyEnvironment(context.runtime, "admission", context.admission);
  const cap = validateAdmissionCapability(context.admission);
  // No environment string enables readiness. The explicit validated capability is
  // required too. Hosted composition is a separately coordinated root contract.
  if (
    cap.authority !== "synthetic_test" ||
    (!isPrivateWorkflow(context.runtime) &&
      (!["development", "test"].includes(context.runtime.environment) ||
        !isLoopbackOrigin(context.runtime.origin)))
  )
    throw new AccessError(503);
  return cap;
}
export function requesterPredicate(
  identity: Pick<Identity, "userId" | "sessionId">,
): SQL {
  return sql`EXISTS(SELECT 1 FROM public.session s JOIN public."user" u ON u.id=s.user_id JOIN public.user_access x ON x.user_id=u.id
    WHERE s.id=${identity.sessionId} AND s.user_id=${identity.userId} AND s.expires_at>clock_timestamp() AND u.email_verified AND u.email LIKE '%.test' AND x.status='active')`;
}
function reviewerPredicate(identity: Identity): SQL {
  return sql`${requesterPredicate(identity)} AND ${adminAssurancePredicate(identity.userId, identity.sessionId)} AND a.requester_user_id<>${identity.userId}
    AND EXISTS(SELECT 1 FROM public.learner_admission_assignments x JOIN public.learner_admission_reviewers r
    ON r.user_id=x.reviewer_user_id AND r.source=x.source AND r.capability_code=x.capability_code
    JOIN public.learner_admission_policies p ON p.id=a.policy_id WHERE x.admission_id=a.id AND x.reviewer_user_id=${identity.userId}
    AND x.source=a.source AND x.capability_code=p.reviewer_capability_code AND r.active)`;
}
export async function readAdmissionIntake(
  context: AdmissionContext,
  headers: Headers,
) {
  const identity = await requireIdentity(context.runtime, headers);
  if (context.admission.authority === "disabled")
    return { enabled: false as const };
  const cap = capability(context);
  const current = await context.runtime.db.execute<{
    available: boolean;
  }>(sql`SELECT ${requesterPredicate(identity)} AND EXISTS(SELECT 1 FROM public.learner_admission_policy_state s JOIN public.learner_admission_policies p ON p.id=s.current_policy_id
    WHERE p.id=${cap.policyId}::uuid AND p.content_digest=${cap.contentDigest} AND p.version=${cap.version} AND s.enabled) AS available`);
  return current.rows[0]?.available
    ? {
        enabled: true as const,
        policyVersion: cap.version,
        policyDigest: cap.contentDigest,
      }
    : { enabled: false as const };
}
async function finalAuthority<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    const cause =
      typeof error === "object" && error !== null && "cause" in error
        ? error.cause
        : error;
    if (
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      cause.code === "42501"
    )
      throw new AccessError(404);
    throw error;
  }
}
function checkOutcome(
  row: { outcome: string; admission_id: string | null } | undefined,
) {
  if (row?.outcome === "forbidden") throw new AccessError(404);
  if (row?.outcome === "policy_unavailable") throw new AccessError(503);
  if (row?.outcome === "invalid")
    throw new RuleError(400, "Check the admission fields and try again.");
  if (row && ["conflict", "exists", "capacity"].includes(row.outcome))
    throw new RuleError(
      409,
      "This request cannot proceed. Reload its current status before trying again.",
    );
  if (
    !row?.admission_id ||
    !["created", "recorded", "decided", "replayed"].includes(row.outcome)
  )
    throw new AccessError(503);
  return row.admission_id;
}
export async function createAdmission(
  context: AdmissionContext,
  headers: Headers,
  input: unknown,
) {
  const cap = capability(context);
  const identity = await requireIdentity(context.runtime, headers);
  const value = admissionInput.parse(input);
  if (
    value.policyVersion !== cap.version ||
    value.policyDigest !== cap.contentDigest
  )
    throw new RuleError(
      409,
      "The admission policy changed. Reload before entering details.",
    );
  const next = canonicalAdmissionSelection(value.next);
  return finalAuthority(
    context.runtime.db.transaction(
      async (tx) => {
        const result = await tx.execute<{
          outcome: string;
          admission_id: string | null;
        }>(
          sql`SELECT * FROM public.create_learner_admission(${identity.userId},${identity.sessionId},${value.requestId}::uuid,${cap.policyId}::uuid,${value.management},${value.displayName},${value.level},${value.timezone},${next})`,
        );
        const id = checkOutcome(result.rows[0]);
        return readRequesterDetail(tx, identity, id);
      },
      { isolationLevel: "read committed" },
    ),
  );
}
const summary = sql`a.id,a.management,a.state,a.revision,a.policy_version AS "policyVersion",a.created_at AS "createdAt"`;
const detail = sql`${summary},json_build_object('id',l.id,'displayName',l.display_name,'level',l.level,'timezone',l.timezone,'management',l.management) AS learner,a.selection_path AS next`;
async function readRequesterDetail(
  db: Pick<Database, "execute">,
  identity: Identity,
  id: string,
) {
  if (!z.uuid().safeParse(id).success) throw new AccessError(404);
  const result =
    await db.execute<AdmissionDetail>(sql`SELECT ${detail},${currentLearnerAuthorityPredicate({ ...identity, learnerId: sql`l.id`, policyId: sql`a.policy_id` })} AS "currentAccess" FROM public.learner_admissions a JOIN public.learner_profiles l ON l.id=a.learner_id
    WHERE a.id=${id}::uuid AND a.requester_user_id=${identity.userId} AND ${requesterPredicate(identity)}`);
  const row = result.rows[0];
  if (!row) throw new AccessError(404);
  return { ...row, next: canonicalAdmissionSelection(row.next) };
}
export async function readMyAdmission(
  context: AdmissionContext,
  headers: Headers,
  id: string,
) {
  capability(context);
  return readRequesterDetail(
    context.runtime.db,
    await requireIdentity(context.runtime, headers),
    id,
  );
}
export type AdmissionPage = {
  items: AdmissionSummary[];
  nextCursor: string | null;
};
async function admissionPage(
  db: Pick<Database, "execute">,
  identity: Identity,
  reviewer: boolean,
  input: unknown,
): Promise<AdmissionPage> {
  const cursor = admissionListCursor(input);
  const visible = reviewer
    ? reviewerPredicate(identity)
    : sql`a.requester_user_id=${identity.userId} AND ${requesterPredicate(identity)}`;
  const comparison = reviewer
    ? sql`(a.created_at,a.id)>(SELECT created_at,id FROM point)`
    : sql`(a.created_at,a.id)<(SELECT created_at,id FROM point)`;
  const order = reviewer
    ? sql`a.created_at ASC,a.id ASC`
    : sql`a.created_at DESC,a.id DESC`;
  const jsonOrder = reviewer
    ? sql`slice."createdAt" ASC,slice.id ASC`
    : sql`slice."createdAt" DESC,slice.id DESC`;
  const result = await db.execute<{
    available: boolean;
    items: AdmissionSummary[];
  }>(sql`
 WITH point AS (SELECT a.created_at,a.id FROM public.learner_admissions a WHERE a.id=${cursor}::uuid AND ${visible}),
 slice AS (SELECT ${summary} FROM public.learner_admissions a WHERE ${visible} AND (${cursor}::uuid IS NULL OR ${comparison}) ORDER BY ${order} LIMIT 21)
 SELECT (${cursor}::uuid IS NULL OR EXISTS(SELECT 1 FROM point)) AS available,
 COALESCE((SELECT json_agg(slice ORDER BY ${jsonOrder}) FROM slice),'[]'::json) AS items`);
  const row = result.rows[0];
  if (!row?.available) throw new AccessError(404);
  const items = row.items
    .slice(0, 20)
    .map((item) => ({ ...item, createdAt: new Date(item.createdAt) }));
  return {
    items,
    nextCursor: row.items.length > 20 ? (items.at(-1)?.id ?? null) : null,
  };
}
export async function listMyAdmissions(
  context: AdmissionContext,
  headers: Headers,
  cursor: unknown = null,
): Promise<AdmissionPage> {
  const identity = await requireIdentity(context.runtime, headers);
  if (context.admission.authority === "disabled")
    return { items: [], nextCursor: null };
  capability(context);
  return admissionPage(context.runtime.db, identity, false, cursor);
}
export async function listAssignedAdmissions(
  context: AdmissionContext,
  headers: Headers,
  cursor: unknown = null,
): Promise<AdmissionPage> {
  capability(context);
  const identity = await requireAdminAssurance(context.runtime, headers);
  return admissionPage(context.runtime.db, identity, true, cursor);
}
async function readReviewerDetail(
  db: Pick<Database, "execute">,
  identity: Identity,
  id: string,
) {
  if (!z.uuid().safeParse(id).success) throw new AccessError(404);
  const result =
    await db.execute<ReviewerAdmissionDetail>(sql`SELECT ${detail},false AS "currentAccess",COALESCE((SELECT json_agg(json_build_object('id',e.id,'checkCode',e.check_code,'reference',e.reference,'revoked',e.revoked_at IS NOT NULL) ORDER BY e.recorded_at,e.id)
    FROM public.learner_admission_evidence e WHERE e.admission_id=a.id),'[]'::json) AS evidence
    FROM public.learner_admissions a JOIN public.learner_profiles l ON l.id=a.learner_id WHERE a.id=${id}::uuid AND ${reviewerPredicate(identity)}`);
  const row = result.rows[0];
  if (!row) throw new AccessError(404);
  return { ...row, next: canonicalAdmissionSelection(row.next) };
}
export async function readAssignedAdmission(
  context: AdmissionContext,
  headers: Headers,
  id: string,
) {
  capability(context);
  return readReviewerDetail(
    context.runtime.db,
    await requireAdminAssurance(context.runtime, headers),
    id,
  );
}
export async function mutateAdmissionReview(
  context: AdmissionContext,
  headers: Headers,
  id: string,
  kind: "evidence" | "decision" | "revoke-evidence",
  input: unknown,
) {
  capability(context);
  const identity = await requireAdminAssurance(context.runtime, headers);
  // Permission precedes validation, so foreign/missing requests give no field feedback.
  await readReviewerDetail(context.runtime.db, identity, id);
  const command =
    kind === "evidence"
      ? evidenceInput.parse(input)
      : kind === "decision"
        ? reviewInput.parse(input)
        : revokeEvidenceInput.parse(input);
  return finalAuthority(
    context.runtime.db.transaction(
      async (tx) => {
        let query: SQL;
        if ("checkCode" in command)
          query = sql`SELECT * FROM public.record_learner_admission_evidence(${identity.userId},${identity.sessionId},${id}::uuid,${command.revision},${command.requestId}::uuid,${command.checkCode},${command.reference})`;
        else if ("action" in command)
          query = sql`SELECT * FROM public.decide_learner_admission(${identity.userId},${identity.sessionId},${id}::uuid,${command.revision},${command.requestId}::uuid,${command.action})`;
        else
          query = sql`SELECT * FROM public.revoke_learner_admission_evidence(${identity.userId},${identity.sessionId},${id}::uuid,${command.revision},${command.requestId}::uuid,${command.evidenceId}::uuid)`;
        const result = await tx.execute<{
          outcome: string;
          admission_id: string | null;
        }>(query);
        checkOutcome(result.rows[0]);
        return readReviewerDetail(tx, identity, id);
      },
      { isolationLevel: "read committed" },
    ),
  );
}
export async function listAdmittedLearners(
  context: AdmissionContext,
  headers: Headers,
) {
  if (context.admission.authority === "disabled") {
    await requireIdentity(context.runtime, headers);
    return [];
  }
  const cap = capability(context);
  const identity = await requireIdentity(context.runtime, headers);
  const result = await context.runtime.db
    .execute<PrivateLearner>(sql`SELECT l.id,l.display_name AS "displayName",l.level,l.timezone,l.management FROM public.learner_profiles l WHERE
    ${currentLearnerAuthorityPredicate({ ...identity, learnerId: sql`l.id`, policyId: cap.policyId })} ORDER BY l.created_at,l.id LIMIT 100`);
  return result.rows;
}
export async function readAdmittedLearner(
  context: AdmissionContext,
  headers: Headers,
  id: string,
) {
  const cap = capability(context);
  if (!z.uuid().safeParse(id).success) throw new AccessError(404);
  return readCurrentAuthorizedLearner(
    context.runtime.db,
    await requireIdentity(context.runtime, headers),
    id,
    cap.policyId,
  );
}
export async function updateAdmittedLearner(
  context: AdmissionContext,
  headers: Headers,
  id: string,
  input: unknown,
) {
  const cap = capability(context);
  await readAdmittedLearner(context, headers, id);
  const identity = await requireIdentity(context.runtime, headers);
  const value = admittedLearnerInput.parse(input);
  return finalAuthority(
    context.runtime.db.transaction(
      async (tx) => {
        const result = await tx.execute<{ updated: boolean }>(
          sql`SELECT public.update_admitted_learner(${identity.userId},${identity.sessionId},${id}::uuid,${cap.policyId}::uuid,${value.displayName},${value.timezone}) AS updated`,
        );
        if (!result.rows[0]?.updated) throw new AccessError(404);
        return readCurrentAuthorizedLearner(tx, identity, id, cap.policyId);
      },
      { isolationLevel: "read committed" },
    ),
  );
}
