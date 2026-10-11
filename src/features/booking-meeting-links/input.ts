import { z } from "zod";
import { validateMeetingLink } from "@/lib/validation/meeting-link";

export const meetingEditInput = z
  .object({
    url: z
      .string()
      .max(2048)
      .refine((value) => validateMeetingLink(value).ok),
    expectedRevision: z.number().int().min(0).max(2147483646),
    requestId: z.uuid(),
  })
  .strict();
