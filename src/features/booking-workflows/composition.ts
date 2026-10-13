import type { AuthRuntime } from "@/lib/auth-factory";
import type { BookingWorkflowContext } from "./service";
import { disabledBooking } from "./policy";
/** Shipped default. Only a test-owned mirror may install synthetic capability. */
export function bookingWorkflowContext(
  runtime: AuthRuntime,
): BookingWorkflowContext {
  return { runtime, booking: disabledBooking };
}
