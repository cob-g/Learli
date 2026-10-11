import { z } from "zod";
import { learnerLevels } from "@/lib/db/schema/app";
import { timeZoneSchema } from "@/lib/validation/time-zone";
import { teachingLanguageCodes } from "./teaching-languages";

const offeringInput = z.strictObject({
  subjectId: z.uuid(),
  levels: z
    .array(z.enum(learnerLevels))
    .min(1)
    .max(learnerLevels.length)
    .refine((levels) => new Set(levels).size === levels.length),
  specialty: z.string().trim().max(120).optional(),
});

/**
 * Everything a tutor may set on their own profile. Review status, ownership and
 * ids are deliberately absent: a strict object rejects them if a client sends them.
 */
export const tutorProfileInput = z
  .strictObject({
    headline: z.string().trim().min(1).max(100),
    bio: z.string().trim().min(1).max(1500),
    teachingBackground: z.string().trim().min(1).max(1000),
    timezone: timeZoneSchema,
    teachingLanguages: z
      .array(z.enum(teachingLanguageCodes))
      .max(teachingLanguageCodes.length)
      .refine((codes) => new Set(codes).size === codes.length)
      .transform((codes) =>
        teachingLanguageCodes.filter((code) => codes.includes(code)),
      )
      .optional(),
    offerings: z
      .array(offeringInput)
      .min(1)
      .max(30)
      .refine(
        (offerings) =>
          new Set(offerings.map((offering) => offering.subjectId)).size ===
          offerings.length,
      ),
  })
  .transform((profile) => ({
    ...profile,
    offerings: profile.offerings.map((offering) => ({
      subjectId: offering.subjectId,
      // Stored in catalog order so equal selections compare equal.
      levels: learnerLevels.filter((level) => offering.levels.includes(level)),
      specialty: offering.specialty || null,
    })),
  }));
export type TutorProfileInput = z.infer<typeof tutorProfileInput>;

const fieldMessages = {
  headline: "Enter a headline of 100 characters or fewer.",
  bio: "Enter an introduction of 1,500 characters or fewer.",
  teachingBackground:
    "Enter your teaching background in 1,000 characters or fewer.",
  timezone: "Choose a time zone.",
  teachingLanguages:
    "Choose each teaching language once from the listed options.",
  offerings: "Choose at least one subject and a level you teach it at.",
} as const;
export type TutorProfileField = keyof typeof fieldMessages;

/** Instructions per invalid field; never echoes the submitted values. */
export function describeTutorProfileIssues(error: z.ZodError) {
  const fields: Partial<Record<TutorProfileField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && field in fieldMessages)
      fields[field as TutorProfileField] =
        fieldMessages[field as TutorProfileField];
  }
  return {
    message: Object.keys(fields).length
      ? "Check the fields marked below."
      : "Check the profile fields. Other values cannot be changed here.",
    fields,
  };
}
