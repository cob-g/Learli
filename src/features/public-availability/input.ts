import { z } from "zod";
import { isValidTimeZone } from "@/lib/time/time-zone";
import { teachingLanguageCodes } from "@/features/tutors/teaching-languages";

export const PUBLIC_CANDIDATE_LIMITS = Object.freeze({
  tutors: 20,
  windows: 840,
  exceptions: 2560,
  busy: 8000,
  timesPerTutor: 720,
  queryCharacters: 2048,
});

export const publicSlugInput = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const publicLevelInput = z.enum([
  "elementary",
  "middle_school",
  "high_school",
  "college_support",
]);
export const publicZoneInput = z.string().max(100).refine(isValidTimeZone);

/** Public filters only. In particular, there is no learner, booking or clock input. */
export const publicCandidateQueryInput = z
  .strictObject({
    tutorSlugs: z
      .array(publicSlugInput)
      .min(1)
      .max(PUBLIC_CANDIDATE_LIMITS.tutors)
      .refine((slugs) => new Set(slugs).size === slugs.length),
    subjectSlug: publicSlugInput,
    level: publicLevelInput,
    displayTimezone: publicZoneInput,
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
  })
  .refine(
    (query) =>
      !query.from || !query.to || new Date(query.from) < new Date(query.to),
    {
      message: "Choose an increasing time range.",
    },
  );

export type PublicCandidateQuery = z.infer<typeof publicCandidateQueryInput>;

/** Directory-only additive contract; original profile/matching input stays strict. */
export const publicDirectoryCandidateQueryInput = z.strictObject({
  tutorSlugs: z
    .array(publicSlugInput)
    .min(1)
    .max(PUBLIC_CANDIDATE_LIMITS.tutors)
    .refine((slugs) => new Set(slugs).size === slugs.length),
  subjectSlug: publicSlugInput.optional(),
  level: publicLevelInput.optional(),
  language: z.enum(teachingLanguageCodes).optional(),
  displayTimezone: publicZoneInput,
});
