import { z } from "zod";

export const subjectName = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} &+\-'().,/]*$/u);

export const subjectNameInput = z.strictObject({ name: subjectName });
export const subjectRenameInput = z.strictObject({
  name: subjectName,
  expectedRevision: z.number().int().min(0).max(2_147_483_646),
});

export const subjectNameHelp =
  "Enter a subject name of 2 to 60 characters that starts with a letter or number.";
