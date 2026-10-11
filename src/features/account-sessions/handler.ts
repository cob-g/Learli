import { ZodError } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import {
  privateJson,
  readSmallJson,
  sameLocalOrigin,
} from "@/lib/auth-handler";
import { AccessError } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import {
  listAccountSessions,
  revokeOtherAccountSession,
  SessionFreshnessError,
} from "./service";

export async function handleAccountSessions(
  runtime: AuthRuntime | null,
  request: Request,
  operation: "list" | "revoke",
) {
  if (!runtime)
    return privateJson({ message: "Account service is unavailable." }, 503);
  if (!sameLocalOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== (operation === "list" ? "GET" : "POST"))
    return privateJson({ message: "Method not allowed." }, 405);
  try {
    if (operation === "list")
      return privateJson({
        sessions: await listAccountSessions(runtime, request.headers),
      });
    let input: unknown;
    try {
      input = (await readSmallJson(request, 1024)).body;
    } catch {
      return privateJson({ message: "Check your request and try again." }, 400);
    }
    return privateJson(
      await revokeOtherAccountSession(runtime, request.headers, input),
    );
  } catch (error) {
    if (error instanceof SessionFreshnessError)
      return privateJson(
        { message: error.message, code: "SESSION_NOT_FRESH" },
        error.status,
      );
    if (error instanceof AccessError || error instanceof RuleError)
      return privateJson({ message: error.message }, error.status);
    if (error instanceof ZodError)
      return privateJson({ message: "Check your request and try again." }, 400);
    return privateJson(
      { message: "Account service is unavailable. Try again later." },
      503,
    );
  }
}
