import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson, sameDomainOrigin } from "@/lib/auth-handler";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { AccessError } from "@/lib/permissions/access";
import { describeIndependentLearnerIssues } from "./input";
import {
  createIndependentLearner,
  readIndependentLearnerIntake,
} from "./service";

export async function handleIndependentLearnerRequest(
  runtime: AuthRuntime | null,
  request: Request,
) {
  if (!runtime)
    return privateJson(
      { message: "College Student setup is unavailable." },
      503,
    );
  if (!sameDomainOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== "POST")
    return privateJson({ message: "Method not allowed." }, 405);
  // Refuse unavailable policy/account state before parsing private profile
  // fields. An existing independent learner is allowed through so a retry with
  // the original opaque request key can replay a committed response safely.
  try {
    const intake = await readIndependentLearnerIntake(runtime, request.headers);
    if (!intake.enabled && !intake.existingLearnerId)
      return privateJson(
        {
          message:
            "College Student setup is unavailable or already completed. Check your account.",
        },
        409,
      );
  } catch (error) {
    return privateJson(
      {
        message:
          "College Student setup is unavailable. Verify your account and try again.",
      },
      error instanceof AccessError ? error.status : 503,
    );
  }
  return handleJsonMutation(
    runtime,
    request,
    { method: "POST", invalid: describeIndependentLearnerIssues },
    (active, input) => createIndependentLearner(active, request.headers, input),
  );
}
