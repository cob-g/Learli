import { ZodError } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import {
  privateJson,
  readSmallJson,
  sameAccountOrigin,
} from "@/lib/auth-handler";
import { AccessError } from "@/lib/permissions/access";
import { emitDiagnostic } from "@/lib/diagnostics.server";
import { enrollParentWorkspace } from "./service";

export async function handleParentOnboarding(
  runtime: AuthRuntime | null,
  request: Request,
) {
  if (!runtime)
    return privateJson({ message: "Account service is unavailable." }, 503);
  if (!sameAccountOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== "POST")
    return privateJson({ message: "Method not allowed." }, 405);
  let input: unknown;
  try {
    input = (await readSmallJson(request)).body;
  } catch {
    return privateJson({ message: "Check your request and try again." }, 400);
  }
  try {
    return privateJson(
      await enrollParentWorkspace(runtime, request.headers, input),
    );
  } catch (error) {
    if (error instanceof AccessError)
      return privateJson({ message: error.message }, error.status);
    if (error instanceof ZodError)
      return privateJson({ message: "Check your request and try again." }, 400);
    emitDiagnostic("mutation.failed");
    return privateJson(
      { message: "Parent setup could not be completed. Try again later." },
      503,
    );
  }
}
