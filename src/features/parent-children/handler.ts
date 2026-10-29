import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson, sameDomainOrigin } from "@/lib/auth-handler";
import { AccessError } from "@/lib/permissions/access";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { describeLearnerIssues } from "@/features/learners/input";
import { createParentChild, readParentChildIntake } from "./service";

export async function handleParentChildRequest(
  runtime: AuthRuntime | null,
  request: Request,
) {
  if (!runtime)
    return privateJson({ message: "Add Child is unavailable." }, 503);
  if (!sameDomainOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== "POST")
    return privateJson({ message: "Method not allowed." }, 405);
  // Refuse unavailable intake before deserializing private child information.
  try {
    if (!(await readParentChildIntake(runtime, request.headers)).enabled)
      return privateJson(
        { message: "Add Child is unavailable. Try again later." },
        503,
      );
  } catch (error) {
    return privateJson(
      { message: "Add Child is unavailable. Check your account access." },
      error instanceof AccessError ? error.status : 503,
    );
  }
  return handleJsonMutation(
    runtime,
    request,
    {
      method: "POST",
      invalid: describeLearnerIssues,
    },
    (active, input) => createParentChild(active, request.headers, input),
  );
}
