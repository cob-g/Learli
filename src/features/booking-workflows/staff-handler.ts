import { ZodError } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson, sameDomainOrigin } from "@/lib/auth-handler";
import { AccessError } from "@/lib/permissions/access";
import { bookingWorkflowContext } from "./composition";
import { listStaffBookings } from "./staff-read";

export async function handleStaffBookingList(
  runtime: AuthRuntime | null,
  request: Request,
) {
  if (!runtime)
    return privateJson({ message: "Assigned bookings are unavailable." }, 503);
  const origin = request.headers.get("origin");
  if (
    !sameDomainOrigin(request, runtime) ||
    (origin !== null && origin !== runtime.origin)
  )
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== "GET")
    return privateJson({ message: "Method not allowed." }, 405);
  try {
    const params = new URL(request.url).searchParams;
    if (new Set(params.keys()).size !== [...params.keys()].length)
      return privateJson({ message: "Choose valid booking filters." }, 400);
    return privateJson(
      await listStaffBookings(
        bookingWorkflowContext(runtime),
        request.headers,
        Object.fromEntries(params),
      ),
    );
  } catch (error) {
    if (error instanceof AccessError)
      return privateJson({ message: error.message }, error.status);
    if (error instanceof ZodError)
      return privateJson({ message: "Choose valid booking filters." }, 400);
    return privateJson(
      { message: "Assigned bookings are unavailable. Try again later." },
      503,
    );
  }
}
