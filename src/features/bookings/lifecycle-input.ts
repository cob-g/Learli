import { z } from "zod";
import { isValidTimeZone } from "@/lib/time/time-zone";
export const cancelDemoInput = z.strictObject({
  requestId: z.uuid(),
  expectedRevision: z.number().int().min(0).max(10000),
});
export const rescheduleDemoInput = cancelDemoInput
  .extend({
    startAtUtc: z.iso.datetime(),
    endAtUtc: z.iso.datetime(),
    displayTimezone: z.string().max(100).refine(isValidTimeZone),
  })
  .refine((value) => new Date(value.endAtUtc) > new Date(value.startAtUtc));
