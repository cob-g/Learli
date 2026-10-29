import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { recheckAdminAssurance } from "@/features/admin-security/assurance";
import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { tutorProfiles, user, type ReviewStatus } from "@/lib/db/schema";
import { AccessError, requireRole } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import { reviewActionNames } from "./review-rules";
import { loadTutorProfile } from "./service";
import { getScreeningContext } from "@/features/tutor-screening/composition";
import { readScreening } from "@/features/tutor-screening/service";
import {
  getPrivateWorkflow,
  assertPrivateWorkflowUnchanged,
} from "@/features/private-workflow/runtime";
import type { PrivateWorkflowPacket } from "@/features/private-workflow/config";
import {
  privateActorPredicate,
  privateTutorPredicate,
} from "@/features/private-workflow/query";
function assigned(
  runtime: AuthRuntime,
  userId: string,
  sessionId: string,
  tutorId: SQL | string = sql`${tutorProfiles.id}`,
  packet: PrivateWorkflowPacket | null = getPrivateWorkflow(runtime),
): SQL {
  const readiness = getScreeningContext(runtime).screening.mode !== "disabled";
  return sql`(${!getLocalWorkflow(runtime)} OR EXISTS(SELECT 1 FROM tutor_screening_cases local_case JOIN tutor_screening_policy_heads local_head ON local_head.provenance=local_case.provenance AND local_head.version=local_case.policy_version AND local_head.status='enabled' JOIN tutor_screening_policies local_policy ON local_policy.provenance=local_head.provenance AND local_policy.version=local_head.version WHERE local_case.tutor_id=${tutorId} AND local_case.provenance='local_operation' AND local_policy.valid_from<=clock_timestamp() AND local_policy.valid_until IS NULL)) AND ${privateActorPredicate(packet, sql`${userId}`)} AND ${privateTutorPredicate(packet, sql`${tutorId}::uuid`)} AND public.has_tutor_screening_authority(${userId},${sessionId},${tutorId}, coalesce((SELECT c.provenance FROM tutor_screening_cases c WHERE c.tutor_id=${tutorId}), 'local_fixture')) AND (${readiness} OR NOT EXISTS(SELECT 1 FROM tutor_screening_cases c WHERE c.tutor_id=${tutorId}))`;
}

export const reviewInput = z.strictObject({
  action: z.enum(reviewActionNames),
});
/** Applications per queue page. */
export const reviewQueueLimit = 50;
const notFound = "We can't find that application.";
const queueScreeningSummary = z.object({
  state: z.enum(["pending", "approved", "rejected", "suspended", "revoked"]),
  currentCount: z.number().int().nonnegative(),
  requiredCount: z.number().int().positive(),
});
export type QueueScreeningSummary = z.infer<typeof queueScreeningSummary>;

/** Safe queue projection only: no receipts, evidence, timestamps or account data. */
function screeningQueueProjection(runtime: AuthRuntime) {
  const capability = getScreeningContext(runtime).screening;
  if (capability.mode === "disabled") return sql<unknown>`NULL`;
  const currentPolicy =
    capability.mode === "local_operation"
      ? sql`p.valid_from<=clock_timestamp() AND p.valid_until IS NULL`
      : sql`p.valid_from<=clock_timestamp() AND p.valid_until>clock_timestamp()`;
  return sql<unknown>`(
    SELECT jsonb_build_object(
      'state', c.state,
      'requiredCount', cardinality(p.required_check_codes),
      'currentCount', (
        SELECT count(*)::int
        FROM unnest(p.required_check_codes) AS required(required_code)
        WHERE EXISTS (
          SELECT 1
          FROM public.tutor_screening_checks ck
          WHERE ck.tutor_id=c.tutor_id
            AND ck.round=c.round
            AND ck.policy_version=c.policy_version
            AND ck.check_code=required.required_code
            AND ck.outcome='passed'
            AND ck.checked_at<=clock_timestamp()
            AND ck.expires_at>clock_timestamp()
            AND NOT EXISTS (
              SELECT 1
              FROM public.tutor_screening_checks newer
              WHERE newer.tutor_id=ck.tutor_id
                AND newer.round=ck.round
                AND newer.check_code=ck.check_code
                AND newer.revision>ck.revision
            )
        )
      )
    )
    FROM public.tutor_screening_cases c
    JOIN public.tutor_screening_policies p
      ON p.provenance=c.provenance AND p.version=c.policy_version
    JOIN public.tutor_screening_policy_heads h
      ON h.provenance=c.provenance AND h.version=c.policy_version
    WHERE c.tutor_id=${tutorProfiles.id}
      AND c.provenance=${capability.provenance}
      AND c.policy_version=${capability.version}
      AND h.status='enabled'
      AND ${currentPolicy}
    LIMIT 1
  )`;
}

/**
 * One page of the review queue, oldest first (id breaks ties so pages never
 * overlap). Returns only what the queue shows. `hasMore` comes from fetching
 * one row beyond the page.
 */
export async function listTutorApplications(
  runtime: AuthRuntime,
  headers: Headers,
  status?: ReviewStatus,
  page = 1,
) {
  const packet = getPrivateWorkflow(runtime);
  const identity = await requireRole(runtime, headers, "admin");
  const safe = Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1;
  const filter = and(
    assigned(runtime, identity.userId, identity.sessionId, undefined, packet),
    status ? eq(tutorProfiles.reviewStatus, status) : undefined,
  );
  const [{ total }] = await runtime.db
    .select({ total: sql<number>`count(*)::int` })
    .from(tutorProfiles)
    .where(filter);
  const applications = await runtime.db
    .select({
      id: tutorProfiles.id,
      displayName: user.name,
      headline: tutorProfiles.headline,
      reviewStatus: tutorProfiles.reviewStatus,
      createdAt: tutorProfiles.createdAt,
      screening: screeningQueueProjection(runtime),
    })
    .from(tutorProfiles)
    .innerJoin(user, eq(user.id, tutorProfiles.userId))
    .where(filter)
    .orderBy(asc(tutorProfiles.createdAt), asc(tutorProfiles.id))
    .limit(reviewQueueLimit + 1)
    .offset((safe - 1) * reviewQueueLimit);
  await recheckAdminAssurance(runtime.db, identity);
  if (getLocalWorkflow(runtime)) {
    const current = await runtime.db.execute<{ allowed: boolean }>(
      sql`SELECT public.has_local_workflow_staff(${identity.userId},${identity.sessionId},'screening') AND EXISTS(SELECT 1 FROM public.tutor_screening_policy_heads h JOIN public.tutor_screening_policies p ON p.provenance=h.provenance AND p.version=h.version WHERE h.provenance='local_operation' AND h.status='enabled' AND p.valid_from<=clock_timestamp() AND p.valid_until IS NULL) AS allowed`,
    );
    if (!current.rows[0]?.allowed) throw new AccessError(404);
  }
  assertPrivateWorkflowUnchanged(runtime, packet);
  return {
    total,
    applications: applications
      .slice(0, reviewQueueLimit)
      .map((application) => ({
        ...application,
        screening: queueScreeningSummary
          .nullable()
          .parse(application.screening),
      })),
    page: safe,
    hasMore: applications.length > reviewQueueLimit && safe < 1000,
  };
}

/** One application for review. The owner's account id and email stay server-side. */
export async function readTutorApplication(
  runtime: AuthRuntime,
  headers: Headers,
  profileId: string,
) {
  const packet = getPrivateWorkflow(runtime);
  const identity = await requireRole(runtime, headers, "admin");
  if (!z.uuid().safeParse(profileId).success)
    throw new RuleError(404, notFound);
  const profile = await loadTutorProfile(
    runtime.db,
    and(
      eq(tutorProfiles.id, profileId),
      assigned(runtime, identity.userId, identity.sessionId, undefined, packet),
    )!,
    assigned(runtime, identity.userId, identity.sessionId, profileId, packet),
  );
  if (!profile) throw new RuleError(404, notFound);
  await recheckAdminAssurance(runtime.db, identity);
  const permission = await runtime.db.execute<{ allowed: boolean }>(
    sql`SELECT ${assigned(runtime, identity.userId, identity.sessionId, undefined, packet)} AS allowed FROM ${tutorProfiles} WHERE ${tutorProfiles.id}=${profileId}::uuid`,
  );
  if (!permission.rows[0]?.allowed) throw new RuleError(404, notFound);
  const { userId, ...application } = profile;
  const screening = await readScreening(
    getScreeningContext(runtime),
    headers,
    profileId,
  );
  const fresh = await runtime.db.execute<{ allowed: boolean }>(
    sql`SELECT ${assigned(runtime, identity.userId, identity.sessionId, undefined, packet)} AS allowed FROM ${tutorProfiles} WHERE ${tutorProfiles.id}=${profileId}::uuid`,
  );
  if (!fresh.rows[0]?.allowed) throw new RuleError(404, notFound);
  assertPrivateWorkflowUnchanged(runtime, packet);
  return {
    ...application,
    ownedByReviewer: userId === identity.userId,
    screening,
  };
}

/**
 * Moves an application along one allowed transition and records who did it.
 * The update is conditional on the expected status, so of two simultaneous
 * reviews exactly one succeeds.
 */
export async function reviewTutorApplication(
  runtime: AuthRuntime,
  headers: Headers,
  profileId: string,
  input: unknown,
) {
  const packet = getPrivateWorkflow(runtime);
  const identity = await requireRole(runtime, headers, "admin");
  // Private reviews use current evidence-based screening, never retained local grants.
  if (packet || getLocalWorkflow(runtime)) throw new AccessError(404);
  const { action } = reviewInput.parse(input);
  if (!z.uuid().safeParse(profileId).success)
    throw new RuleError(404, notFound);
  return runtime.db.transaction(
    async (tx) => {
      const r = await tx.execute<{
        outcome: string;
        status: ReviewStatus | null;
      }>(
        sql`SELECT * FROM public.review_local_tutor_application(${identity.userId},${identity.sessionId},${profileId}::uuid,${action})`,
      );
      // The function may have waited on the profile/assignment. Keep its writes
      // uncommitted until a newly enabled or replaced packet has been ruled out.
      assertPrivateWorkflowUnchanged(runtime, packet);
      const row = r.rows[0];
      if (row?.outcome === "forbidden")
        throw new RuleError(403, "This action is unavailable.");
      if (row?.outcome === "not_found") throw new RuleError(404, notFound);
      if (row?.outcome === "conflict")
        throw new RuleError(
          409,
          "This application changed. Reload the page and try again.",
        );
      if (!row?.status || row.outcome !== "saved") throw new AccessError(503);
      return { reviewStatus: row.status };
    },
    { isolationLevel: "read committed" },
  );
}
