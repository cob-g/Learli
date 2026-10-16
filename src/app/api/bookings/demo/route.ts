import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import { handleWorkflowMutation } from "@/features/booking-workflows/handler";
import { getDomainAuthRuntime } from "@/lib/auth";
import { handleDemoBookingCreate } from "@/features/bookings/handler";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const runtime = await getDomainAuthRuntime();
  if (
    runtime &&
    bookingWorkflowContext(runtime).booking.authority !== "disabled"
  )
    return handleWorkflowMutation(runtime, request);
  return handleDemoBookingCreate(runtime, request);
}
