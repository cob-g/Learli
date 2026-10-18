import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { isPrivateWorkflow } from "@/features/private-workflow/runtime";
import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson, sameDomainOrigin } from "@/lib/auth-handler";
import { AccessError } from "@/lib/permissions/access";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { describeLearnerIssues } from "./input";
import {
  updateComposedLearner,
  readComposedLearner,
  listLearnerGroups,
} from "./composition";
import { admissionContext } from "@/features/learner-admission/context";
import { createMyLearner, listMyLearners, readMyLearner } from "./service";

export async function handleLearnerRequest(
  runtime: AuthRuntime | null,
  request: Request,
  learnerId?: string,
) {
  if (request.method === "POST" && !learnerId) {
    // A private learner must pass reviewed admission; hidden fixture forms are not authority.
    if (runtime && (getLocalWorkflow(runtime) || isPrivateWorkflow(runtime)))
      return privateJson(
        { message: "Use learner admission to request a learner profile." },
        503,
      );
    return handleJsonMutation(
      runtime,
      request,
      { method: "POST", invalid: describeLearnerIssues },
      (active, input) => createMyLearner(active, request.headers, input),
    );
  }
  if (request.method === "PATCH" && learnerId) {
    return handleJsonMutation(
      runtime,
      request,
      { method: "PATCH", invalid: describeLearnerIssues },
      (active, input) =>
        updateComposedLearner(active, request.headers, learnerId, input),
    );
  }
  if (!runtime)
    return privateJson({ message: "Learner profiles are unavailable." }, 503);
  if (!sameDomainOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== "GET")
    return privateJson({ message: "Method not allowed." }, 405);
  try {
    if (admissionContext(runtime).admission.authority !== "disabled") {
      if (learnerId)
        return privateJson(
          (await readComposedLearner(runtime, request.headers, learnerId))
            .profile,
        );
      const groups = await listLearnerGroups(runtime, request.headers);
      return privateJson([...groups.demo, ...groups.readiness]);
    }
    return privateJson(
      learnerId
        ? await readMyLearner(runtime, request.headers, learnerId)
        : await listMyLearners(runtime, request.headers),
    );
  } catch (error) {
    if (error instanceof AccessError)
      return privateJson({ message: error.message }, error.status);
    return privateJson(
      { message: "Learner profiles are unavailable. Try again later." },
      503,
    );
  }
}
