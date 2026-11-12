import type { AuthRuntime } from "@/lib/auth-factory";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { privateJson } from "@/lib/auth-handler";
import { bookingWorkflowContext } from "./composition";
import {
  createPolicyReservation,
  changePolicyBooking,
  type BookingWorkflowContext,
} from "./service";
import type { WorkflowAction } from "./input";
import { scheduleLocalBookingNotices } from "@/features/transactional-delivery/local";
export function handleWorkflowMutation(
  runtime: AuthRuntime | null,
  request: Request,
  bookingId?: string,
  action?: WorkflowAction,
  context?: BookingWorkflowContext,
) {
  if (!runtime)
    return privateJson({ message: "Booking workflows unavailable." }, 503);
  const c = context ?? bookingWorkflowContext(runtime);
  if (c.booking.authority === "disabled")
    return privateJson(
      { message: "Booking policy is unavailable. Contact support." },
      503,
    );
  return handleJsonMutation(
    runtime,
    request,
    {
      method: "POST",
      invalid: () => ({ message: "Check the booking details and try again." }),
    },
    async (_r, input) => {
      const receipt = await (bookingId && action
        ? changePolicyBooking(c, request.headers, bookingId, action, input)
        : createPolicyReservation(c, request.headers, input));
      // Service resolution establishes that the transaction has committed.
      scheduleLocalBookingNotices(runtime, receipt.eventId);
      return receipt;
    },
  );
}
