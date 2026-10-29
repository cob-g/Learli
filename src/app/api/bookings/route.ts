import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import { handleWorkflowMutation } from "@/features/booking-workflows/handler";
import { handleBookingRead } from "@/features/bookings/read-handler";
import { getDomainAuthRuntime } from "@/lib/auth";
import { privateJson } from "@/lib/auth-handler";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handleBookingRead(await getDomainAuthRuntime(), request);
}
export async function POST(request: Request) {
  const runtime = await getDomainAuthRuntime();
  if (
    !runtime ||
    bookingWorkflowContext(runtime).booking.authority === "disabled"
  )
    return privateJson(
      { message: "Booking requests are unavailable. Try again later." },
      503,
    );
  return handleWorkflowMutation(runtime, request);
}
