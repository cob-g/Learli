import { ZodError } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import {
  privateJson,
  readSmallJson,
  sameLocalOrigin,
} from "@/lib/auth-handler";
import { AccessError } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import { passwordChangeInput } from "./input";
import { changeOwnPassword, PasswordFreshnessError } from "./service";

export const uncertainPasswordChange = () =>
  privateJson(
    {
      code: "CHANGE_UNCERTAIN",
      message:
        "We couldn't confirm the password change. Try signing in, or reset your password to recover access.",
    },
    503,
  );

/** Explicit safe projection; provider JSON contains a replacement session token. */
export async function projectPasswordResponse(provider: Response) {
  let response: Response;
  if (provider.status === 200) {
    response = privateJson({ status: true });
  } else if (provider.status >= 500 || provider.status < 400) {
    response = uncertainPasswordChange();
  } else if (provider.status === 429) {
    response = privateJson(
      { message: "Too many password attempts. Wait a minute, then try again." },
      429,
    );
    const retryAfter =
      provider.headers.get("retry-after") ??
      provider.headers.get("x-retry-after");
    if (retryAfter && /^\d{1,6}$/.test(retryAfter))
      response.headers.set("retry-after", retryAfter);
  } else {
    const body: unknown = await provider.json().catch(() => null);
    const code =
      body && typeof body === "object" && "code" in body ? body.code : null;
    response =
      code === "SESSION_NOT_FRESH"
        ? privateJson(
            {
              code: "SESSION_NOT_FRESH",
              message: "Sign out, then sign in again to change your password.",
            },
            403,
          )
        : provider.status === 401
          ? privateJson(
              { message: "Sign in again to change your password." },
              401,
            )
          : privateJson(
              {
                message:
                  "Password change refused. Check your current password and try again.",
              },
              provider.status === 403 ? 403 : 400,
            );
  }
  for (const cookie of provider.headers.getSetCookie())
    response.headers.append("set-cookie", cookie);
  return response;
}

export async function handleAccountPassword(
  runtime: AuthRuntime | null,
  request: Request,
) {
  if (!runtime)
    return privateJson({ message: "Account service is unavailable." }, 503);
  if (!sameLocalOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== "POST")
    return privateJson({ message: "Method not allowed." }, 405);
  try {
    let input: unknown;
    try {
      input = (await readSmallJson(request, 2048)).body;
    } catch {
      return privateJson(
        { message: "Check the password fields and try again." },
        400,
      );
    }
    const parsed = passwordChangeInput.parse(input);
    return await projectPasswordResponse(
      await changeOwnPassword(runtime, request.headers, parsed),
    );
  } catch (error) {
    if (error instanceof PasswordFreshnessError)
      return privateJson(
        { code: "SESSION_NOT_FRESH", message: error.message },
        403,
      );
    if (error instanceof AccessError || error instanceof RuleError)
      return privateJson({ message: error.message }, error.status);
    if (error instanceof ZodError)
      return privateJson(
        {
          message:
            "Enter your current password and matching new passwords of 12 to 128 characters.",
        },
        400,
      );
    // Never promise rollback: the provider might already have written the hash.
    return uncertainPasswordChange();
  }
}
