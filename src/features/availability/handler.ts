import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson } from "@/lib/auth-handler";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { AccessError } from "@/lib/permissions/access";
import { describeAvailabilityIssues } from "./input";
import { readOwnAvailability, saveOwnAvailability } from "./service";

export function handleAvailabilitySave(
  runtime: AuthRuntime | null,
  request: Request,
) {
  return handleJsonMutation(
    runtime,
    request,
    { method: "PUT", invalid: describeAvailabilityIssues },
    (active, input) => saveOwnAvailability(active, request.headers, input),
  );
}
export async function handleAvailabilityRead(
  runtime: AuthRuntime | null,
  request: Request,
) {
  if (!runtime)
    return privateJson({ message: "This service is unavailable." }, 503);
  try {
    return privateJson({
      schedule: await readOwnAvailability(runtime, request.headers),
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
