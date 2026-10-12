import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson, sameLocalOrigin } from "@/lib/auth-handler";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { AccessError } from "@/lib/permissions/access";
import { describeReviewIssues } from "./input";
import {
  listModeratorReviews,
  moderateReview,
  readAuthorReview,
  readModeratorReview,
  submitReview,
} from "./service";
async function runReview(
  runtime: AuthRuntime | null,
  request: Request,
  scope: "author" | "moderator",
  id?: string,
) {
  if (request.method === "POST" && scope === "author" && id)
    return handleJsonMutation(
      runtime,
      request,
      { method: "POST", invalid: describeReviewIssues },
      (r, input) => submitReview(r, request.headers, id, input),
    );
  if (request.method === "PATCH" && scope === "moderator" && id)
    return handleJsonMutation(
      runtime,
      request,
      { method: "PATCH", invalid: describeReviewIssues },
      (r, input) => moderateReview(r, request.headers, id, input),
    );
  if (!runtime)
    return privateJson({ message: "Local reviews are unavailable." }, 503);
  if (!sameLocalOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== "GET" || (scope === "author" && !id))
    return privateJson({ message: "Method not allowed." }, 405);
  try {
    return privateJson(
      scope === "author"
        ? await readAuthorReview(runtime, request.headers, id ?? "")
        : id
          ? await readModeratorReview(runtime, request.headers, id)
          : await listModeratorReviews(runtime, request.headers),
    );
  } catch (e) {
    if (e instanceof AccessError)
      return privateJson({ message: e.message }, e.status);
    return privateJson({ message: "Local reviews are unavailable." }, 503);
  }
}

export async function handleReview(...args: Parameters<typeof runReview>) {
  const response = await runReview(...args);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
