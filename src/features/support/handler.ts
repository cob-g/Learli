import { ZodError } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson, sameLocalOrigin } from "@/lib/auth-handler";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { AccessError } from "@/lib/permissions/access";
import { describeSupportIssues } from "./input";
import {
  changeCaseStatus,
  createCase,
  listCases,
  readCase,
  type CaseScope,
} from "./service";

export async function handleSupportRequest(
  runtime: AuthRuntime | null,
  request: Request,
  scope: CaseScope,
  caseId?: string,
  status = false,
) {
  if (request.method === "POST" && scope === "requester" && !caseId)
    return handleJsonMutation(
      runtime,
      request,
      { method: "POST", bodyLimit: 16384, invalid: describeSupportIssues },
      (active, input) => createCase(active, request.headers, input),
    );
  if (request.method === "PATCH" && scope === "reviewer" && caseId && status)
    return handleJsonMutation(
      runtime,
      request,
      { method: "PATCH", invalid: describeSupportIssues },
      (active, input) =>
        changeCaseStatus(active, request.headers, caseId, input),
    );
  if (!runtime)
    return privateJson({ message: "Local support is unavailable." }, 503);
  if (!sameLocalOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== "GET" || status)
    return privateJson({ message: "Method not allowed." }, 405);
  try {
    return privateJson(
      caseId
        ? await readCase(runtime, request.headers, caseId, scope)
        : await listCases(
            runtime,
            request.headers,
            scope,
            new URL(request.url).searchParams.get("page") ?? 1,
          ),
    );
  } catch (error) {
    if (error instanceof AccessError)
      return privateJson({ message: error.message }, error.status);
    if (error instanceof ZodError)
      return privateJson({ message: "Choose a valid case page." }, 400);
    return privateJson(
      { message: "Local support is unavailable. Try again later." },
      503,
    );
  }
}
