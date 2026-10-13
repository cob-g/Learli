import type { AuthRuntime } from "@/lib/auth-factory";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { privateJson, sameLocalOrigin } from "@/lib/auth-handler";
import { AccessError } from "@/lib/permissions/access";
import { getSafeguardingContext } from "./composition";
import {
  createSafeguardingCase,
  changeSafeguardingResponse,
  readSafeguardingCase,
  canIntake,
} from "./service";
export async function handleSafeguarding(
  runtime: AuthRuntime | null,
  request: Request,
  caseId?: string,
) {
  if (!runtime)
    return privateJson({ message: "Safeguarding is unavailable." }, 503);
  const context = getSafeguardingContext(runtime);
  if (request.method === "POST") {
    if (context.safeguarding.mode === "disabled")
      return privateJson(
        { message: "New safeguarding intake and actions are disabled." },
        503,
      );
    if (!caseId) {
      try {
        if (!(await canIntake(context)))
          return privateJson(
            { message: "New safeguarding intake is disabled." },
            503,
          );
      } catch {
        return privateJson(
          { message: "New safeguarding intake is disabled." },
          503,
        );
      }
    }
    return handleJsonMutation(
      runtime,
      request,
      {
        method: "POST",
        bodyLimit: 16384,
        invalid: () => ({ message: "Check the response fields." }),
      },
      (_active, input) =>
        caseId
          ? changeSafeguardingResponse(context, request.headers, caseId, input)
          : createSafeguardingCase(context, request.headers, input),
    );
  }
  if (request.method !== "GET" || !caseId)
    return privateJson({ message: "Method not allowed." }, 405);
  if (!sameLocalOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  const q = new URL(request.url).searchParams.get("scope"),
    scope =
      q === "dispatcher"
        ? "dispatcher"
        : q === "reviewer"
          ? "reviewer"
          : "requester";
  try {
    return privateJson(
      await readSafeguardingCase(context, request.headers, caseId, scope),
    );
  } catch (e) {
    return privateJson(
      { message: "This case is unavailable." },
      e instanceof AccessError ? e.status : 503,
    );
  }
}
