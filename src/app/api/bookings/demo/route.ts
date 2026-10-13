import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import { handleWorkflowMutation } from "@/features/booking-workflows/handler";
import { getAuthRuntime } from "@/lib/auth";
import { handleDemoBookingCreate } from "@/features/bookings/handler";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  const runtime = getAuthRuntime();
  if (
    runtime &&
    bookingWorkflowContext(runtime).booking.authority !== "disabled"
  )
    return handleWorkflowMutation(runtime, request);
  return handleDemoBookingCreate(runtime, request);
}
