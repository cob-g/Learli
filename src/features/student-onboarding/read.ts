import type { AuthRuntime } from "@/lib/auth-factory";
import { AccessError } from "@/lib/permissions/access";
import { admissionContext } from "@/features/learner-admission/context";
import {
  listMyAdmissions,
  readAdmissionIntake,
} from "@/features/learner-admission/service";
import { listLearnerGroups } from "@/features/learners/composition";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { readIndependentLearnerIntake } from "@/features/independent-learner/service";

async function findLegacySelfAdmission(runtime: AuthRuntime, headers: Headers) {
  const context = admissionContext(runtime);
  if (context.admission.authority === "disabled") return null;
  let cursor: string | null = null;
  // Historical v1 rows remain visible under their original contract. Automatic
  // v2 receipts are excluded by listMyAdmissions and never enter this queue.
  for (let page = 0; page < 2; page++) {
    const result = await listMyAdmissions(context, headers, cursor);
    const existing = result.items.find((row) => row.management === "self");
    if (existing) return existing.id;
    if (!result.nextCursor) return null;
    cursor = result.nextCursor;
  }
  throw new AccessError(503);
}

/** Reuse requester-scoped reads. Pending/rejected/revoked self profiles are
 * retained too, and the database never permits another self profile for them. */
export async function readStudentOnboarding(
  runtime: AuthRuntime,
  headers: Headers,
) {
  const context = admissionContext(runtime);
  if (getLocalWorkflow(runtime)) {
    const admissionId = await findLegacySelfAdmission(runtime, headers);
    if (admissionId)
      return {
        kind: "legacy" as const,
        enabled: false,
        admissionId,
        existingLearnerId: null,
      };
    const intake = await readIndependentLearnerIntake(runtime, headers);
    return {
      kind: "independent" as const,
      admissionId: null,
      ...intake,
    };
  }
  const intake = await readAdmissionIntake(context, headers);
  if (context.admission.authority === "disabled")
    return {
      kind: "legacy" as const,
      enabled: false,
      admissionId: null,
      existingLearnerId: null,
    };
  return {
    kind: "legacy" as const,
    enabled: intake.enabled,
    admissionId: await findLegacySelfAdmission(runtime, headers),
    existingLearnerId: null,
  };
}

/** A stale role alone must not advertise an authorized Student workspace. */
export async function canOpenStudentWorkspace(
  runtime: AuthRuntime,
  headers: Headers,
) {
  const groups = await listLearnerGroups(runtime, headers);
  return [...groups.demo, ...groups.readiness].some(
    (learner) =>
      learner.management === "self" && learner.level === "college_support",
  );
}
