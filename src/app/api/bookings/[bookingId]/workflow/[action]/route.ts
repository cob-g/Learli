import { getAuthRuntime } from "@/lib/auth";
import { handleWorkflowMutation } from "@/features/booking-workflows/handler";
import { privateJson } from "@/lib/auth-handler";
import type { WorkflowAction } from "@/features/booking-workflows/input";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string; action: string }> },
) {
  const { bookingId, action } = await params;
  if (
    !["confirm", "cancel", "reschedule", "complete", "no_show"].includes(action)
  )
    return privateJson({ message: "Booking action unavailable." }, 404);
  return handleWorkflowMutation(
    getAuthRuntime(),
    request,
    bookingId,
    action as WorkflowAction,
  );
}
