import { z } from "zod";
import { timeZoneSchema } from "@/lib/validation/time-zone";
import { LocalTimeError, resolveLocalTime } from "./local-time";

/** Technical list bound, not a retention or booking-horizon policy. */
export const maxTimeOffIntervals = 128;
const version = z.number().int().min(0).max(2_147_483_646);
export const timeOffInput = z
  .discriminatedUnion("operation", [
    z.strictObject({
      operation: z.literal("add"),
      version,
      timezone: timeZoneSchema,
      startLocal: z.string().max(16),
      endLocal: z.string().max(16),
    }),
    z.strictObject({ operation: z.literal("remove"), version, id: z.uuid() }),
  ])
  .superRefine((value, ctx) => {
    if (value.operation !== "add") return;
    let start: Date | undefined, end: Date | undefined;
    for (const field of ["startLocal", "endLocal"] as const) {
      try {
        const instant = resolveLocalTime(value[field], value.timezone);
        if (field === "startLocal") start = instant;
        else end = instant;
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message:
            error instanceof LocalTimeError
              ? error.message
              : "Choose a valid regional time zone.",
        });
      }
    }
    if (start && end && end <= start)
      ctx.addIssue({
        code: "custom",
        path: ["endLocal"],
        message: "Choose an end date and time after the start.",
      });
  });
export type TimeOffInput = z.infer<typeof timeOffInput>;
export type TimeOffErrors = Record<string, string>;
export function describeTimeOffIssues(error: z.ZodError) {
  const fields: TimeOffErrors = {};
  for (const issue of error.issues)
    fields[issue.path.join(".")] =
      issue.code === "custom" ? issue.message : "Check this value.";
  return {
    message: "Check the marked fields. Only time off can be changed here.",
    fields,
  };
}
