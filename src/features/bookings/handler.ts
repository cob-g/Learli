import { ZodError } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson, sameLocalOrigin } from "@/lib/auth-handler";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { AccessError } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import { createDemoReservation, readDemoCandidates } from "./service";

export function handleDemoBookingCreate(
  runtime: AuthRuntime | null,
  request: Request,
) {
  return handleJsonMutation(
    runtime,
    request,
    {
      method: "POST",
      invalid: () => ({
        message:
          "Choose a learner, tutor, subject, time and time zone, then try again.",
      }),
    },
    (active, input) => createDemoReservation(active, request.headers, input),
  );
}

export async function handleDemoCandidateRead(
  runtime: AuthRuntime | null,
  request: Request,
) {
  if (!runtime)
    return privateJson({ message: "Simulated bookings are unavailable." }, 503);
  if (!sameLocalOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== "GET")
    return privateJson({ message: "Method not allowed." }, 405);
  try {
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some((key) => params.getAll(key).length !== 1))
      throw new RuleError(
        400,
        "Choose the booking details once and try again.",
      );
    return privateJson(
      await readDemoCandidates(
        runtime,
        request.headers,
        Object.fromEntries(params),
      ),
    );
  } catch (error) {
    if (error instanceof AccessError || error instanceof RuleError)
      return privateJson({ message: error.message }, error.status);
    if (error instanceof ZodError)
      return privateJson(
        {
          message:
            "Choose a learner, tutor, subject and time zone to load open times.",
        },
        400,
      );
    return privateJson(
      { message: "Open times could not be loaded. Try again later." },
      503,
    );
  }
}
