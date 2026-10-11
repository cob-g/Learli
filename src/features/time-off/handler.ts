import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson } from "@/lib/auth-handler";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { AccessError } from "@/lib/permissions/access";
import { describeTimeOffIssues } from "./input";
import { readOwnTimeOff, saveOwnTimeOff } from "./service";

export function handleTimeOffSave(
  runtime: AuthRuntime | null,
  request: Request,
) {
  return handleJsonMutation(
    runtime,
    request,
    { method: "POST", invalid: describeTimeOffIssues },
    (active, input) => saveOwnTimeOff(active, request.headers, input),
  );
}
export async function handleTimeOffRead(
  runtime: AuthRuntime | null,
  request: Request,
) {
  if (!runtime)
    return privateJson({ message: "This service is unavailable." }, 503);
  try {
    return privateJson({
      schedule: await readOwnTimeOff(runtime, request.headers),
    });
  } catch (error) {
    if (error instanceof AccessError)
      return privateJson({ message: error.message }, error.status);
    return privateJson(
      { message: "This service is unavailable. Try again later." },
      503,
    );
  }
}
