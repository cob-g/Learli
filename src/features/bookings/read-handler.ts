import { ZodError } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { privateJson, sameDomainOrigin } from "@/lib/auth-handler";
import { AccessError } from "@/lib/permissions/access";
import { bookingReadScope } from "./read-input";
import {
  listParticipantBookings,
  readParticipantBooking,
} from "./read-service";

export async function handleBookingRead(
  runtime: AuthRuntime | null,
  request: Request,
  bookingId?: string,
) {
  if (!runtime)
    return privateJson({ message: "Local bookings are unavailable." }, 503);
  if (!sameDomainOrigin(request, runtime))
    return privateJson({ message: "Request origin is not allowed." }, 403);
  if (request.method !== "GET")
    return privateJson({ message: "Method not allowed." }, 405);
  try {
    const params = new URL(request.url).searchParams;
    // Duplicates and unsupported identity/role fields cannot be silently dropped.
    if (new Set(params.keys()).size !== [...params.keys()].length)
      return privateJson({ message: "Choose valid booking filters." }, 400);
    if (bookingId) {
      if ([...params.keys()].some((key) => key !== "scope"))
        return privateJson({ message: "Choose valid booking filters." }, 400);
      const scope = bookingReadScope.parse(params.get("scope"));
      return privateJson(
        await readParticipantBooking(
          runtime,
          request.headers,
          bookingId,
          scope,
        ),
      );
    }
    return privateJson(
      await listParticipantBookings(
        runtime,
        request.headers,
        Object.fromEntries(params),
      ),
    );
  } catch (error) {
    if (error instanceof AccessError)
      return privateJson(
        {
          message:
            error.status === 404
              ? "We can't find that booking on this account."
              : error.message,
        },
        error.status,
      );
    if (error instanceof ZodError)
      return privateJson({ message: "Choose valid booking filters." }, 400);
    return privateJson(
      { message: "We couldn't load bookings. Try again later." },
      503,
    );
  }
}
