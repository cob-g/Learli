import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson, sameLocalOrigin } from "@/lib/auth-handler";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { AccessError } from "@/lib/permissions/access";
import { publicationContext } from "./composition";
import {
  readAuthorPublication,
  readModeratorPublication,
  listModeratorPublications,
  submitPublication,
  decidePublication,
} from "./service";
export async function handlePublication(
  runtime: AuthRuntime | null,
  request: Request,
  scope: "author" | "moderator",
  id?: string,
) {
  let response: Response;
  if (
    (request.method === "POST" && scope === "author" && id) ||
    (request.method === "PATCH" && scope === "moderator" && id)
  ) {
    response = await handleJsonMutation(
      runtime,
      request,
      {
        method: scope === "author" ? "POST" : "PATCH",
        invalid: () => ({
          message:
            "Check the rating, comment and moderation fields, then try again.",
        }),
      },
      (r, input) =>
        scope === "author"
          ? submitPublication(
              publicationContext(r),
              request.headers,
              id ?? "",
              input,
            )
          : decidePublication(
              publicationContext(r),
              request.headers,
              id ?? "",
              input,
            ),
    );
  } else if (!runtime)
    response = privateJson(
      { message: "Review publication is unavailable." },
      503,
    );
  else if (!sameLocalOrigin(request, runtime))
    response = privateJson({ message: "Request origin is not allowed." }, 403);
  else if (request.method !== "GET" || (scope === "author" && !id))
    response = privateJson({ message: "Method not allowed." }, 405);
  else {
    try {
      const c = publicationContext(runtime);
      response = privateJson(
        scope === "author"
          ? await readAuthorPublication(c, request.headers, id ?? "")
          : id
            ? await readModeratorPublication(c, request.headers, id)
            : await listModeratorPublications(c, request.headers),
      );
    } catch (e) {
      response = privateJson(
        {
          message:
            e instanceof AccessError
              ? e.message
              : "Review publication is unavailable.",
        },
        e instanceof AccessError ? e.status : 503,
      );
    }
  }
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
