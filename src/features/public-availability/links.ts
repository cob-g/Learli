import { z } from "zod";
import { demoBookingPolicy } from "@/features/bookings/demo-policy";
import { publicLevelInput, publicSlugInput, publicZoneInput } from "./input";

const profileLinkInput = z
  .strictObject({
    tutorSlug: publicSlugInput,
    subjectSlug: publicSlugInput,
    level: publicLevelInput,
    displayTimezone: publicZoneInput,
    startAtUtc: z.iso.datetime().optional(),
    endAtUtc: z.iso.datetime().optional(),
  })
  .refine(
    (choice) =>
      (!choice.startAtUtc && !choice.endAtUtc) ||
      (!!choice.startAtUtc &&
        !!choice.endAtUtc &&
        new Date(choice.endAtUtc).getTime() -
          new Date(choice.startAtUtc).getTime() ===
          demoBookingPolicy.durationMinutes * 60_000),
  );

/** Shared matching -> profile link. Every value is a visitor-selected public filter. */
export function publicProfileHref(input: z.infer<typeof profileLinkInput>) {
  const choice = profileLinkInput.parse(input);
  const params = new URLSearchParams({
    subject: choice.subjectSlug,
    level: choice.level,
    displayTimezone: choice.displayTimezone,
  });
  if (choice.startAtUtc && choice.endAtUtc) {
    params.set("startAtUtc", new Date(choice.startAtUtc).toISOString());
    params.set("endAtUtc", new Date(choice.endAtUtc).toISOString());
  }
  return `/tutors/${choice.tutorSlug}?${params}`;
}
