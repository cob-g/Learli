import { z } from "zod";
import { isValidTimeZone } from "@/lib/time/time-zone";

const slug = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const bookingChoiceInput = z.strictObject({
  learnerId: z.uuid(),
  tutorSlug: slug,
  subjectSlug: slug,
  displayTimezone: z.string().max(100).refine(isValidTimeZone),
});
export const createDemoBookingInput = bookingChoiceInput
  .extend({
    startAtUtc: z.iso.datetime(),
    endAtUtc: z.iso.datetime(),
    idempotencyKey: z.uuid(),
  })
  .refine((value) => new Date(value.endAtUtc) > new Date(value.startAtUtc));
export type DemoBookingInput = z.infer<typeof createDemoBookingInput>;
