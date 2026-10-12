import type { AuthRuntime } from "@/lib/auth-factory";
import { handleJsonMutation } from "@/lib/mutation-handler";
import { changeDemoBooking } from "./lifecycle-service";
export function handleDemoLifecycleChange(
  runtime: AuthRuntime | null,
  request: Request,
  bookingId: string,
  action: "cancel" | "reschedule",
) {
  return handleJsonMutation(
    runtime,
    request,
    {
      method: "POST",
      invalid: () => ({
        message: "Reload this simulated booking and choose the change again.",
      }),
    },
    (active, input) =>
      changeDemoBooking(active, request.headers, bookingId, action, input),
  );
}
