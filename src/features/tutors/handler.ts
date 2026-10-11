import type { AuthRuntime } from "@/lib/auth-factory";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { describeTutorProfileIssues } from "./input";
import { reviewTutorApplication } from "./review";
import { saveOwnTutorProfile, startTutorApplication } from "./service";

export function handleTutorProfileRequest(
  runtime: AuthRuntime | null,
  request: Request,
) {
  return handleJsonMutation(
    runtime,
    request,
    // Long introductions in multi-byte scripts exceed the default 8 KB body.
    { method: "PUT", bodyLimit: 32_768, invalid: describeTutorProfileIssues },
    (active, input) => saveOwnTutorProfile(active, request.headers, input),
  );
}

export function handleTutorApplicationStart(
  runtime: AuthRuntime | null,
  request: Request,
) {
  return handleJsonMutation(
    runtime,
    request,
    {
      method: "POST",
      invalid: () => ({ message: "Check your request and try again." }),
    },
    (active, input) => startTutorApplication(active, request.headers, input),
  );
}

export function handleTutorReviewRequest(
  runtime: AuthRuntime | null,
  request: Request,
  profileId: string,
) {
  return handleJsonMutation(
    runtime,
    request,
    {
      method: "POST",
      invalid: () => ({ message: "Check your request and try again." }),
    },
    (active, input) =>
      reviewTutorApplication(active, request.headers, profileId, input),
  );
}
