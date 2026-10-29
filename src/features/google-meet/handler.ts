import { z, ZodError } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import {
  privateHeaders,
  privateJson,
  readSmallJson,
  sameDomainOrigin,
} from "@/lib/auth-handler";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { AccessError } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import { googleMeetConfig, MEET_PAGE, type GoogleMeetConfig } from "./config";
import { googleMeetProvider, type GoogleMeetProvider } from "./provider";
import {
  startGoogleConnection,
  finishGoogleConnection,
  disconnectGoogleConnection,
} from "./service";

const cookieName = "learli-meet-oauth";
const cookie = (value: string, age: number) =>
  `${cookieName}=${value}; Path=/api/tutor/meeting-providers/google; HttpOnly; SameSite=Lax; Max-Age=${age}`;
const redirect = (origin: string, result: string) =>
  new Response(null, {
    status: 303,
    headers: {
      ...privateHeaders,
      Location: `${origin}${MEET_PAGE}?result=${result}`,
      "Set-Cookie": cookie("", 0),
    },
  });
function readBinding(headers: Headers) {
  const values = (headers.get("cookie") ?? "")
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${cookieName}=`));
  return values.length === 1 ? values[0].slice(cookieName.length + 1) : null;
}
export async function handleGoogleMeet(
  runtime: AuthRuntime | null,
  request: Request,
  action: "connect" | "callback" | "disconnect",
) {
  try {
    if (!runtime || !getLocalWorkflow(runtime))
      return privateJson(
        { message: "Google connection is unavailable in this environment." },
        503,
      );
    if (!sameDomainOrigin(request, runtime))
      return privateJson({ message: "Request origin is not allowed." }, 403);
    const config = googleMeetConfig();
    return await googleMeetBoundary(
      runtime,
      request,
      action,
      config,
      config ? googleMeetProvider(config) : null,
    );
  } catch {
    return privateJson(
      {
        message:
          "Google connection is unavailable. Your bookings and manual links are unchanged.",
      },
      503,
    );
  }
}
/** Injectable boundary for deterministic integration tests; routes always use
 * the environment-gated factory above, never browser-selected transports. */
export async function googleMeetBoundary(
  runtime: AuthRuntime,
  request: Request,
  action: "connect" | "callback" | "disconnect",
  config: GoogleMeetConfig | null,
  provider: GoogleMeetProvider | null,
) {
  if (!sameDomainOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== (action === "callback" ? "GET" : "POST"))
    return privateJson({ message: "Method not allowed." }, 405);
  if (action === "callback") {
    if (!config || !provider || request.url.length > 8192)
      return redirect(runtime.origin, "failed");
    try {
      const result = await finishGoogleConnection(
        runtime,
        request.headers,
        config,
        provider,
        new URL(request.url).searchParams,
        readBinding(request.headers),
      );
      return redirect(runtime.origin, result);
    } catch {
      return redirect(runtime.origin, "failed");
    }
  }
  try {
    const input = (await readSmallJson(request, 1024)).body;
    if (action === "disconnect") {
      z.object({ confirm: z.literal(true) })
        .strict()
        .parse(input);
      return privateJson(
        await disconnectGoogleConnection(
          runtime,
          request.headers,
          config,
          provider,
        ),
      );
    }
    if (!config || !provider)
      return privateJson(
        {
          message:
            "Automatic Google Meet is not configured. Use a manual Zoom or Meet link.",
        },
        503,
      );
    const result = await startGoogleConnection(
      runtime,
      request.headers,
      config,
      provider,
      input,
    );
    return Response.json(
      { url: result.url },
      {
        headers: {
          ...privateHeaders,
          "Set-Cookie": cookie(result.browser, 600),
        },
      },
    );
  } catch (error) {
    if (error instanceof AccessError || error instanceof RuleError)
      return privateJson({ message: error.message }, error.status);
    if (error instanceof ZodError)
      return privateJson(
        { message: "Confirm your consent and try again." },
        400,
      );
    return privateJson(
      {
        message:
          "Google connection could not be changed. Try again shortly; sign in again if needed.",
      },
      503,
    );
  }
}
