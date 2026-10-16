import { ZodError } from "zod";
import type { AuthRuntime } from "./auth-factory";
import { privateJson, readSmallJson, sameDomainOrigin } from "./auth-handler";
import { AccessError } from "./permissions/access";
import { RuleError } from "./rule-error";
import { emitDiagnostic } from "./diagnostics.server";

/**
 * Shared boundary for a JSON write: runtime present, exact same-origin request,
 * bounded body, then the feature service, with safe error translation.
 */
export async function handleJsonMutation(
  runtime: AuthRuntime | null,
  request: Request,
  options: {
    method: "POST" | "PUT" | "PATCH";
    bodyLimit?: number;
    invalid: (error: ZodError) => Record<string, unknown>;
  },
  run: (runtime: AuthRuntime, input: unknown) => Promise<unknown>,
) {
  if (!runtime) {
    emitDiagnostic("mutation.unavailable");
    return privateJson({ message: "This service is unavailable." }, 503);
  }
  if (!sameDomainOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== options.method)
    return privateJson({ message: "Method not allowed." }, 405);
  let input: unknown;
  try {
    input = (await readSmallJson(request, options.bodyLimit)).body;
  } catch {
    return privateJson({ message: "Check your request and try again." }, 400);
  }
  try {
    return privateJson(await run(runtime, input));
  } catch (error) {
    if (error instanceof AccessError || error instanceof RuleError) {
      if (error instanceof AccessError && error.status === 503)
        emitDiagnostic("mutation.unavailable");
      return privateJson({ message: error.message }, error.status);
    }
    if (error instanceof ZodError)
      return privateJson(options.invalid(error), 400);
    emitDiagnostic("mutation.failed");
    return privateJson(
      { message: "This service is unavailable. Try again later." },
      503,
    );
  }
}
