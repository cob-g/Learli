import type { AuthRuntime } from "./auth-factory";
import { syntheticEmail } from "./local-mode";

export const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
};
export function privateJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: privateHeaders });
}
export function sameLocalOrigin(request: Request, runtime: AuthRuntime) {
  const expected = new URL(runtime.origin);
  const host = request.headers.get("host");
  // Next.js can reconstruct Request.url with localhost internally. Validate the
  // actual Host against our configured loopback host, never forwarded headers.
  const matchesHost = host
    ? host === expected.host
    : new URL(request.url).origin === expected.origin;
  return (
    matchesHost &&
    (request.method === "GET" ||
      request.headers.get("origin") === expected.origin)
  );
}
const allowedPostFields: Record<string, string[]> = {
  "sign-up/email": ["email", "password", "name", "callbackURL", "rememberMe"],
  "sign-in/email": ["email", "password", "callbackURL", "rememberMe"],
  "sign-out": [],
  "request-password-reset": ["email", "redirectTo"],
  "reset-password": ["token", "newPassword"],
  "send-verification-email": ["email", "callbackURL"],
};
export async function readSmallJson(request: Request, limit = 8192) {
  if (
    !request.headers.get("content-type")?.startsWith("application/json") ||
    !request.body
  )
    throw new Error("Invalid request");
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Invalid request");
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  const body: unknown = JSON.parse(raw);
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("Invalid request");
  return { body: body as Record<string, unknown>, raw };
}
export async function handleAuthRequest(
  runtime: AuthRuntime | null,
  request: Request,
) {
  if (!runtime)
    return privateJson({ message: "Local accounts are not configured." }, 503);
  if (!sameLocalOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  const route = new URL(request.url).pathname.replace(/^\/api\/auth\//, "");
  const headers = new Headers(request.headers);
  // Direct loopback server: forwarded headers are not trusted client identity.
  headers.set("x-learli-local-ip", "127.0.0.1");
  let body: string | undefined;
  if (request.method === "POST") {
    const fields = allowedPostFields[route];
    if (!fields) return privateJson({ message: "Not found." }, 404);
    try {
      const parsed = await readSmallJson(request);
      if (Object.keys(parsed.body).some((key) => !fields.includes(key)))
        throw new Error();
      if (
        typeof parsed.body.email === "string" &&
        !syntheticEmail(parsed.body.email)
      )
        throw new Error();
      body = parsed.raw;
    } catch {
      return privateJson(
        {
          message:
            "Check your request. Local accounts use synthetic .test email addresses.",
        },
        400,
      );
    }
  } else if (
    request.method !== "GET" ||
    !(
      route === "get-session" ||
      route === "verify-email" ||
      /^reset-password\/[^/]+$/.test(route)
    )
  ) {
    return privateJson({ message: "Not found." }, 404);
  }
  try {
    const response = await runtime.auth.handler(
      new Request(request.url, { method: request.method, headers, body }),
    );
    for (const [name, value] of Object.entries(privateHeaders))
      response.headers.set(name, value);
    if (response.status >= 500)
      return privateJson(
        { message: "Account service is unavailable. Try again later." },
        503,
      );
    return response;
  } catch {
    return privateJson(
      { message: "Account service is unavailable. Try again later." },
      503,
    );
  }
}
