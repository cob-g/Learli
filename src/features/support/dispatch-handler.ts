import { ZodError } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson, sameLocalOrigin } from "@/lib/auth-handler";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { AccessError } from "@/lib/permissions/access";
import {
  changeAssignment,
  listDispatchCases,
  readDispatchCase,
} from "./dispatch-service";
export async function handleDispatchRequest(
  runtime: AuthRuntime | null,
  request: Request,
  caseId?: string,
) {
  if (request.method === "PATCH" && caseId)
    return handleJsonMutation(
      runtime,
      request,
      {
        method: "PATCH",
        invalid: () => ({
          message: "Choose a reviewer and local action, then try again.",
        }),
      },
      (active, input) =>
        changeAssignment(active, request.headers, caseId, input),
    );
  if (!runtime)
    return privateJson(
      { message: "Local support assignment is unavailable." },
      503,
    );
  if (!sameLocalOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== "GET")
    return privateJson({ message: "Method not allowed." }, 405);
  try {
    const page = new URL(request.url).searchParams.get("page") ?? 1;
    return privateJson(
      caseId
        ? await readDispatchCase(runtime, request.headers, caseId, page)
        : await listDispatchCases(runtime, request.headers, page),
    );
  } catch (error) {
    if (error instanceof AccessError)
      return privateJson({ message: error.message }, error.status);
    if (error instanceof ZodError)
      return privateJson({ message: "Choose a valid case page." }, 400);
    return privateJson(
      { message: "Local support assignment is unavailable. Try again later." },
      503,
    );
  }
}
