import { z } from "zod";
import { timeZoneSchema } from "@/lib/validation/time-zone";
import {
  isValidWeeklyWindow,
  type WeeklyWindow,
} from "@/lib/time/availability";

/** Request-size guard, independent of lesson duration and slot-start policy. */
export const maxWeeklyWindows = 42;
export const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
const weekMinutes = 7 * 1440;

/** Include the previous week's tail so Sunday overnight overlaps Monday. */
export function overlappingWindowIndexes(windows: readonly WeeklyWindow[]) {
  const spans = windows.flatMap((window, index) => {
    const start = (window.isoWeekday - 1) * 1440 + window.startMinute;
    const end = (window.isoWeekday - 1) * 1440 + window.endMinute;
    return [
      { start, end, index },
      { start: start - weekMinutes, end: end - weekMinutes, index },
    ];
  });
  const invalid = new Set<number>();
  for (let a = 0; a < spans.length; a++) {
    for (let b = a + 1; b < spans.length; b++) {
      const left = spans[a],
        right = spans[b];
      if (
        left.index !== right.index &&
        left.start < right.end &&
        right.start < left.end
      ) {
        invalid.add(left.index);
        invalid.add(right.index);
      }
    }
  }
  return invalid;
}

export const availabilityInput = z
  .strictObject({
    version: z.number().int().min(0).max(2_147_483_646),
    timezone: timeZoneSchema,
    windows: z
      .array(
        z
          .strictObject({
            isoWeekday: z.number().int().min(1).max(7),
            startMinute: z.number().int().min(0).max(1439),
            endMinute: z.number().int().min(1).max(2879),
          })
          .superRefine((window, ctx) => {
            if (!isValidWeeklyWindow(window))
              ctx.addIssue({
                code: "custom",
                path: ["endMinute"],
                message:
                  "End time must follow start time, within 24 hours. Select next day for an overnight range.",
              });
          }),
      )
      .max(maxWeeklyWindows),
  })
  .superRefine(({ windows }, ctx) => {
    for (const index of overlappingWindowIndexes(windows))
      ctx.addIssue({
        code: "custom",
        path: ["windows", index, "startMinute"],
        message:
          "These weekly hours overlap another range. Shorten or remove one range.",
      });
  });
export type AvailabilityInput = z.infer<typeof availabilityInput>;
export type AvailabilityErrors = Record<string, string>;
export function describeAvailabilityIssues(error: z.ZodError) {
  const fields: AvailabilityErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    fields[key] =
      key === "timezone"
        ? "Choose a valid regional time zone."
        : key === "windows"
          ? `Use at most ${maxWeeklyWindows} time ranges.`
          : issue.code === "custom"
            ? issue.message
            : "Check this value.";
  }
  return {
    message:
      "Check the marked fields. Only weekly hours and time zone can be changed here.",
    fields,
  };
}
