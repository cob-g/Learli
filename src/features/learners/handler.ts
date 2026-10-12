import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson, sameLocalOrigin } from "@/lib/auth-handler";
import { AccessError } from "@/lib/permissions/access";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { describeLearnerIssues } from "./input";
import {
  createMyLearner,
  listMyLearners,
  readMyLearner,
  updateMyLearner,
} from "./service";

export async function handleLearnerRequest(
  runtime: AuthRuntime | null,
  request: Request,
  learnerId?: string,
) {
  if (request.method === "POST" && !learnerId) {
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
        updateMyLearner(active, request.headers, learnerId, input),
    );
  }
  if (!runtime)
    return privateJson({ message: "Learner profiles are unavailable." }, 503);
  if (!sameLocalOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== "GET")
    return privateJson({ message: "Method not allowed." }, 405);
  try {
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
