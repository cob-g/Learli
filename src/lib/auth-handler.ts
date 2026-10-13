import { isAPIError } from "better-auth/api";
import type { AuthRuntime } from "./auth-factory";
import { syntheticEmail } from "./local-mode";
import {
  accountHeadersAllowed,
  providerHeaders,
  permitsAccountEmail,
} from "@/features/hosted-auth/request";
import { safeHostedCallback } from "@/features/hosted-auth/callback";
import { refusedMailResponse } from "@/features/hosted-auth/mail-attempt";

export const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
};
export function privateJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: privateHeaders });
}
export function sameLocalOrigin(request: Request, runtime: AuthRuntime) {
  if ("hosted" in runtime) return false;
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
export function sameAccountOrigin(request: Request, runtime: AuthRuntime) {
  return "hosted" in runtime
    ? accountHeadersAllowed(runtime, request.headers, request.method !== "GET")
    : sameLocalOrigin(request, runtime);
}
const allowedPostFields: Record<string, string[]> = {
  "two-factor/enable": ["password"],
  "two-factor/disable": ["password"],
  "two-factor/generate-backup-codes": ["password"],
  "two-factor/verify-totp": ["code"],
  "two-factor/verify-backup-code": ["code"],
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
  if (!sameAccountOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  const route = new URL(request.url).pathname.replace(/^\/api\/auth\//, "");
  const headers = providerHeaders(
    runtime,
    request.headers,
    request.method !== "GET",
  );
  // Direct loopback server: forwarded headers are not trusted client identity.
  let body: string | undefined;
  if (request.method === "POST") {
    if ("hosted" in runtime && new URL(request.url).search)
      return privateJson({ message: "Check your request." }, 400);
    const fields = allowedPostFields[route];
    if (!fields) return privateJson({ message: "Not found." }, 404);
    try {
      const parsed = await readSmallJson(request);
      if (Object.keys(parsed.body).some((key) => !fields.includes(key)))
        throw new Error();
      if (
        typeof parsed.body.email === "string" &&
        (!syntheticEmail(parsed.body.email) ||
          !permitsAccountEmail(runtime, parsed.body.email))
      )
        throw new Error();
      if ("hosted" in runtime) {
        if (
          [
            "sign-up/email",
            "request-password-reset",
            "send-verification-email",
          ].includes(route) &&
          runtime.hosted.mail.mode === "disabled"
        )
          return privateJson(
            { message: "Account messages are unavailable." },
            503,
          );
        if (
          parsed.body.callbackURL !== undefined &&
          !safeHostedCallback(parsed.body.callbackURL, runtime.origin)
        )
          throw new Error();
        if (
          parsed.body.redirectTo !== undefined &&
          !safeHostedCallback(parsed.body.redirectTo, runtime.origin, true)
        )
          throw new Error();
      }
      if (route.startsWith("two-factor/")) {
        if (
          route.endsWith("verify-totp") &&
          (typeof parsed.body.code !== "string" ||
            !/^\d{6}$/.test(parsed.body.code))
        )
          throw new Error();
        if (
          route.endsWith("verify-backup-code") &&
          (typeof parsed.body.code !== "string" ||
            !/^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/.test(parsed.body.code))
        )
          throw new Error();
        if (
          !route.includes("verify-") &&
          (typeof parsed.body.password !== "string" ||
            parsed.body.password.length < 1 ||
            parsed.body.password.length > 128)
        )
          throw new Error();
      }
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
  if (
    "hosted" in runtime &&
    request.method === "GET" &&
    route !== "get-session"
  ) {
    const query = new URL(request.url).searchParams;
    const allowed =
      route === "verify-email" ? ["token", "callbackURL"] : ["callbackURL"];
    if (
      [...query.keys()].some(
        (key) => !allowed.includes(key) || query.getAll(key).length !== 1,
      ) ||
      !safeHostedCallback(
        query.get("callbackURL"),
        runtime.origin,
        route !== "verify-email",
      )
    )
      return privateJson({ message: "Check your request." }, 400);
  }
  try {
    const dispatch = async () => {
      const call = () =>
        runtime.auth.handler(
          new Request(
            `${runtime.origin}${new URL(request.url).pathname}${new URL(request.url).search}`,
            { method: request.method, headers, body },
          ),
        );
      const attempt =
        "hosted" in runtime
          ? await runtime.mailAttempt.run(call)
          : { value: await call(), failed: false };
      const response = attempt.failed
        ? refusedMailResponse(attempt.value)
        : attempt.value;
      if (
        response.ok &&
        [
          "two-factor/enable",
          "two-factor/disable",
          "two-factor/generate-backup-codes",
        ].includes(route)
      ) {
        const cookies = new Map(
          (headers.get("cookie") ?? "").split(";").map((part) => {
            const index = part.indexOf("=");
            return [part.slice(0, index).trim(), part.slice(index + 1)];
          }),
        );
        for (const cookie of response.headers.getSetCookie()) {
          const part = cookie.split(";")[0],
            index = part.indexOf("=");
          cookies.set(part.slice(0, index), part.slice(index + 1));
        }
        const currentHeaders = new Headers(headers);
        currentHeaders.set(
          "cookie",
          [...cookies].map(([key, value]) => `${key}=${value}`).join("; "),
        );
        try {
          const revoked = await runtime.auth.api.revokeOtherSessions({
            headers: currentHeaders,
            asResponse: true,
          });
          for (const cookie of revoked.headers.getSetCookie())
            response.headers.append("Set-Cookie", cookie);
          if (!revoked.ok) throw new Error("Revocation incomplete.");
        } catch {
          const failed = privateJson(
            {
              message:
                "Security changed, but session recovery is incomplete. Sign in again and verify before continuing.",
            },
            503,
          );
          for (const cookie of response.headers.getSetCookie())
            failed.headers.append("Set-Cookie", cookie);
          return failed;
        }
      }
      return response;
    };
    const response = route.startsWith("two-factor/")
      ? await runtime.adminSecurity.run(dispatch)
      : await dispatch();
    for (const [name, value] of Object.entries(privateHeaders))
      response.headers.set(name, value);
    if (response.status >= 500) {
      if ("hosted" in runtime) {
        const headers = new Headers(response.headers);
        headers.delete("content-length");
        headers.delete("content-encoding");
        for (const [name, value] of Object.entries(privateHeaders))
          headers.set(name, value);
        return Response.json(
          { message: "Account service is unavailable. Try again later." },
          { status: 503, headers },
        );
      }
      const failed = privateJson(
        { message: "Account service is unavailable. Try again later." },
        503,
      );
      for (const cookie of response.headers.getSetCookie())
        failed.headers.append("Set-Cookie", cookie);
      return failed;
    }
    if (route.startsWith("two-factor/") && response.ok) {
      const result: unknown = await response.json();
      let value: unknown = { verified: true };
      if (
        route === "two-factor/enable" &&
        result &&
        typeof result === "object" &&
        "totpURI" in result &&
        typeof result.totpURI === "string" &&
        "backupCodes" in result
      ) {
        const secret = new URL(result.totpURI).searchParams.get("secret");
        value = { secret, backupCodes: result.backupCodes };
      } else if (
        route === "two-factor/generate-backup-codes" &&
        result &&
        typeof result === "object" &&
        "backupCodes" in result
      )
        value = { backupCodes: result.backupCodes };
      const safe = privateJson(value);
      for (const cookie of response.headers.getSetCookie())
        safe.headers.append("Set-Cookie", cookie);
      return safe;
    }
    return response;
  } catch (error) {
    return privateJson(
      { message: "Account service is unavailable. Try again later." },
      isAPIError(error) && error.statusCode < 500 ? error.statusCode : 503,
    );
  }
}
