import { ZodError } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import {
  privateJson,
  readSmallJson,
  sameAccountOrigin,
} from "@/lib/auth-handler";
import { AccessError } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import { createEmailChangeInput, type EmailChangeInput } from "./input";
import { changeOwnEmail, EmailFreshnessError } from "./service";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";

export const uncertainEmailChange = () =>
  privateJson(
    {
      code: "CHANGE_UNCERTAIN",
      message:
        "Your email may already have changed, and other sessions may still be signed in. Open your account to check the saved address and manage sessions before starting another change.",
    },
    503,
  );
export async function projectEmailResponse(
  provider: Response,
  action: EmailChangeInput["action"],
  revocationFailed = false,
) {
  let response: Response;
  if (
    revocationFailed ||
    provider.status >= 500 ||
    provider.status < 200 ||
    (provider.status > 200 && provider.status < 400)
  )
    response = uncertainEmailChange();
  else if (provider.status === 200)
    response = privateJson({
      status: true,
      stage:
        action === "start"
          ? "current"
          : action === "request"
            ? "new"
            : "complete",
    });
  else if (provider.status === 429) {
    response = privateJson(
      {
        message:
          "Too many confirmation attempts. Wait a minute, then try again.",
      },
      429,
    );
    const retry =
      provider.headers.get("retry-after") ??
      provider.headers.get("x-retry-after");
    if (retry && /^\d{1,6}$/.test(retry))
      response.headers.set("retry-after", retry);
  } else
    response = privateJson(
      {
        message:
          "Confirmation refused. Check the address and code, or restart confirmation.",
      },
      provider.status === 401 ? 401 : provider.status === 403 ? 403 : 400,
    );
  for (const cookie of provider.headers.getSetCookie())
    response.headers.append("set-cookie", cookie);
  return response;
}
export async function handleAccountEmail(
  runtime: AuthRuntime | null,
  request: Request,
) {
  if (!runtime)
    return privateJson({ message: "Account service is unavailable." }, 503);
  if (!sameAccountOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== "POST")
    return privateJson({ message: "Method not allowed." }, 405);
  try {
    let body: unknown;
    try {
      body = (await readSmallJson(request, 2048)).body;
    } catch {
      return privateJson(
        { message: "Check your email confirmation fields." },
        400,
      );
    }
    const input = createEmailChangeInput(!!getLocalWorkflow(runtime)).parse(
      body,
    );
    const { provider, revocationFailed } = await changeOwnEmail(
      runtime,
      request.headers,
      input,
    );
    return projectEmailResponse(provider, input.action, revocationFailed);
  } catch (error) {
    if (error instanceof EmailFreshnessError)
      return privateJson(
        { code: "SESSION_NOT_FRESH", message: error.message },
        403,
      );
    if (error instanceof AccessError || error instanceof RuleError)
      return privateJson({ message: error.message }, error.status);
    if (error instanceof ZodError || error instanceof SyntaxError)
      return privateJson(
        {
          message: getLocalWorkflow(runtime)
            ? "Enter a valid email address and a six-digit confirmation code."
            : "Enter a synthetic .test address and a six-digit confirmation code.",
        },
        400,
      );
    return uncertainEmailChange();
  }
}
