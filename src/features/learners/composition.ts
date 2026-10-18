import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { isPrivateWorkflow } from "@/features/private-workflow/runtime";
import type { AuthRuntime } from "@/lib/auth-factory";
import { AccessError, requireIdentity } from "@/lib/permissions/access";
import { admissionContext } from "@/features/learner-admission/context";
import {
  listAdmittedLearners,
  readAdmittedLearner,
  updateAdmittedLearner,
} from "@/features/learner-admission/service";
import { listMyLearners, readMyLearner, updateMyLearner } from "./service";
/** Explicit composition preserves the historical demo service and predicate. */
export async function listLearnerGroups(
  runtime: AuthRuntime,
  headers: Headers,
) {
  const identity = await requireIdentity(runtime, headers);
  const demoAllowed =
    !getLocalWorkflow(runtime) &&
    !isPrivateWorkflow(runtime) &&
    identity.roles.some((r) => r === "parent" || r === "student");
  const context = admissionContext(runtime);
  if (!demoAllowed && context.admission.authority === "disabled")
    throw new AccessError(403);
  return {
    demo: demoAllowed ? await listMyLearners(runtime, headers) : [],
    readiness: await listAdmittedLearners(context, headers),
    demoAllowed,
    admissionEnabled: context.admission.authority !== "disabled",
  };
}
export async function readComposedLearner(
  runtime: AuthRuntime,
  headers: Headers,
  id: string,
) {
  // Private staging uses reviewed admissions only; legacy fixture guards stay local.
  if (getLocalWorkflow(runtime) || isPrivateWorkflow(runtime))
    return {
      profile: await readAdmittedLearner(
        admissionContext(runtime),
        headers,
        id,
      ),
      reviewed: true,
    };
  // Never choose an error path from a foreign record's source/existence.
  try {
    return {
      profile: await readMyLearner(runtime, headers, id),
      reviewed: false,
    };
  } catch (error) {
    if (!(error instanceof AccessError) || ![403, 404].includes(error.status))
      throw error;
    if (admissionContext(runtime).admission.authority === "disabled")
      throw error;
  }
  return {
    profile: await readAdmittedLearner(admissionContext(runtime), headers, id),
    reviewed: true,
  };
}
export async function updateComposedLearner(
  runtime: AuthRuntime,
  headers: Headers,
  id: string,
  input: unknown,
) {
  const resolved = await readComposedLearner(runtime, headers, id);
  return resolved.reviewed
    ? updateAdmittedLearner(admissionContext(runtime), headers, id, input)
    : updateMyLearner(runtime, headers, id, input);
}
