import { getAuthRuntime } from "@/lib/auth";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { privateJson } from "@/lib/auth-handler";
import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import { getSafeguardingContext } from "@/features/safeguarding/composition";
import { createBookingDispute } from "@/features/booking-workflows/service";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const runtime = getAuthRuntime(),
    { bookingId } = await params;
  if (!runtime)
    return privateJson({ message: "Booking dispute unavailable." }, 503);
  const c = bookingWorkflowContext(runtime),
    response = getSafeguardingContext(runtime);
  if (
    c.booking.authority === "disabled" ||
    response.safeguarding.mode === "disabled"
  )
    return privateJson(
      { message: "A reviewed dispute intake policy is unavailable." },
      503,
    );
  return handleJsonMutation(
    runtime,
    request,
    {
      method: "POST",
      invalid: () => ({ message: "Check the fictional dispute fields." }),
    },
    (_r, input) =>
      createBookingDispute(c, request.headers, bookingId, input, response),
  );
}
