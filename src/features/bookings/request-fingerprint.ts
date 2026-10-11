import { createHash } from "node:crypto";
import type { DemoBookingInput } from "./input";
export function bookingFingerprint(values: DemoBookingInput) {
  // Explicit tuple includes every semantic field, independent of JSON property order.
  return createHash("sha256")
    .update(
      JSON.stringify([
        values.learnerId,
        values.tutorSlug,
        values.subjectSlug,
        new Date(values.startAtUtc).toISOString(),
        new Date(values.endAtUtc).toISOString(),
        values.displayTimezone,
      ]),
    )
    .digest("hex");
}
