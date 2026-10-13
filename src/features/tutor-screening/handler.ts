import type { AuthRuntime } from "@/lib/auth-factory";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { privateJson } from "@/lib/auth-handler";
import { getScreeningContext } from "./composition";
import {
  decideScreening,
  recordScreeningCheck,
  requestScreening,
} from "./service";
export async function handleScreeningMutation(
  runtime: AuthRuntime | null,
  request: Request,
  tutorId: string,
  kind: "checks" | "decision" | "request",
) {
  if (runtime && getScreeningContext(runtime).screening.mode === "disabled")
    return privateJson(
      { message: "New screening workflows are disabled." },
      503,
    );
  return handleJsonMutation(
    runtime,
    request,
    {
      method: "POST",
      invalid: () => ({ message: "Check the screening fields and dates." }),
    },
    (active, input) => {
      const context = getScreeningContext(active);
      return kind === "checks"
        ? recordScreeningCheck(context, request.headers, tutorId, input)
        : kind === "decision"
          ? decideScreening(context, request.headers, tutorId, input)
          : requestScreening(context, request.headers, tutorId, input);
    },
  );
}
