import type { AuthRuntime } from "@/lib/auth-factory";
import {
  privateHeaders,
  privateJson,
  sameLocalOrigin,
} from "@/lib/auth-handler";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { AccessError } from "@/lib/permissions/access";
import { readPrivateMeetingLink, savePrivateMeetingLink } from "./service";

export function handleMeetingEdit(
  runtime: AuthRuntime | null,
  request: Request,
  bookingId: string,
) {
  return handleJsonMutation(
    runtime,
    request,
    {
      method: "PUT",
      bodyLimit: 4096,
      invalid: () => ({
        message:
          "Enter a supported HTTPS Zoom or Google Meet test link and reload before retrying a changed link.",
      }),
    },
    (active, input) =>
      savePrivateMeetingLink(active, request.headers, bookingId, input),
  );
}

export async function handleMeetingRead(
  runtime: AuthRuntime | null,
  request: Request,
  bookingId: string,
) {
  if (!runtime)
    return privateJson({ message: "Meeting links are unavailable." }, 503);
  if (!sameLocalOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== "GET")
    return privateJson({ message: "Method not allowed." }, 405);
  const params = new URL(request.url).searchParams;
  if (
    [...params.keys()].some((key) => key !== "open") ||
    (params.has("open") &&
      (params.getAll("open").length !== 1 || params.get("open") !== "1"))
  )
    return privateJson({ message: "Check your request." }, 400);
  try {
    const result = await readPrivateMeetingLink(
      runtime,
      request.headers,
      bookingId,
    );
    if (params.has("open")) {
      if (result.state !== "present")
        return privateJson(
          { message: "The test meeting link is unavailable." },
          404,
        );
      return new Response(null, {
        status: 303,
        headers: { ...privateHeaders, Location: result.url },
      });
    }
    return privateJson(result);
  } catch (error) {
    if (error instanceof AccessError)
      return privateJson({ message: error.message }, error.status);
    return privateJson(
      { message: "Meeting links could not be loaded. Try again later." },
      503,
    );
  }
}
