import { ZodError } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson, sameLocalOrigin } from "@/lib/auth-handler";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { AccessError } from "@/lib/permissions/access";
import { invalidInput } from "./input";
import { changeAccess, listTargets, readTarget } from "./service";
export async function handleAccountRestrictions(
  runtime: AuthRuntime | null,
  request: Request,
  targetId?: string,
) {
  if (request.method === "PATCH" && targetId)
    return handleJsonMutation(
      runtime,
      request,
      { method: "PATCH", bodyLimit: 2048, invalid: invalidInput },
      (r, input) => changeAccess(r, request.headers, targetId, input),
    );
  if (!runtime)
    return privateJson(
      { message: "Local account restrictions are unavailable." },
      503,
    );
  if (!sameLocalOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== "GET")
    return privateJson({ message: "Method not allowed." }, 405);
  try {
    const params = new URL(request.url).searchParams;
    if (
      [...params.keys()].some((key) => key !== "page") ||
      params.getAll("page").length > 1
    )
      return privateJson({ message: "Choose a valid account page." }, 400);
    const page = params.get("page") ?? 1;
    return privateJson(
      targetId
        ? await readTarget(runtime, request.headers, targetId, page)
        : await listTargets(runtime, request.headers, page),
    );
  } catch (error) {
    if (error instanceof AccessError)
      return privateJson({ message: error.message }, error.status);
    if (error instanceof ZodError)
      return privateJson({ message: "Choose a valid account page." }, 400);
    return privateJson(
      {
        message: "Local account restrictions are unavailable. Try again later.",
      },
      503,
    );
  }
}
