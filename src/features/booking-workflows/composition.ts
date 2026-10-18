import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { getPrivateWorkflow } from "@/features/private-workflow/runtime";
import type { AuthRuntime } from "@/lib/auth-factory";
import type { BookingWorkflowContext } from "./service";
import {
  disabledBooking,
  localBookingPolicy,
  validateBookingCapability,
} from "./policy";
/** Ordinary local identity selects its own receipt; private/test composition stays separate. */
export function bookingWorkflowContext(
  runtime: AuthRuntime,
): BookingWorkflowContext {
  return {
    runtime,
    booking: getLocalWorkflow(runtime)
      ? validateBookingCapability(localBookingPolicy, "development")
      : (getPrivateWorkflow(runtime)?.booking ?? disabledBooking),
  };
}
