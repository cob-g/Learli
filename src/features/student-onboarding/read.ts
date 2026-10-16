import type { AuthRuntime } from "@/lib/auth-factory";
import { AccessError } from "@/lib/permissions/access";
import { admissionContext } from "@/features/learner-admission/context";
import {
  listMyAdmissions,
  readAdmissionIntake,
} from "@/features/learner-admission/service";
import { listLearnerGroups } from "@/features/learners/composition";

/** Reuse requester-scoped reads. Pending/rejected/revoked self profiles are
 * retained too, and the database never permits another self profile for them. */
export async function readStudentOnboarding(
  runtime: AuthRuntime,
  headers: Headers,
) {
  const context = admissionContext(runtime);
  const intake = await readAdmissionIntake(context, headers);
  if (context.admission.authority === "disabled")
    return { enabled: false, admissionId: null };
  let cursor: string | null = null;
  // create_learner_admission (0023:277-280) counts all guardian rows, including
  // rejected/revoked ones, up to twenty; user_id uniqueness permits one self.
  // Do not mistake unexpected overflow for permission to create another.
  for (let page = 0; page < 2; page++) {
    const result = await listMyAdmissions(context, headers, cursor);
    const existing = result.items.find((row) => row.management === "self");
    if (existing) return { enabled: intake.enabled, admissionId: existing.id };
    if (!result.nextCursor)
      return { enabled: intake.enabled, admissionId: null };
    cursor = result.nextCursor;
  }
  throw new AccessError(503);
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
