import { z } from "zod";
import { isValidTimeZone } from "@/lib/time/time-zone";
const instant = z.iso.datetime({ offset: true });
export const workflowChoice = z.strictObject({
  learnerId: z.uuid(),
  tutorSlug: z.string().regex(/^[a-z0-9-]{1,160}$/),
  subjectSlug: z.string().regex(/^[a-z0-9-]{1,100}$/),
  displayTimezone: z.string().refine(isValidTimeZone),
});
export const workflowCreate = workflowChoice.extend({
  startAtUtc: instant,
  endAtUtc: instant,
  idempotencyKey: z.uuid(),
});
export const workflowChange = z.strictObject({
  requestId: z.uuid(),
  expectedRevision: z.number().int().min(0),
  reasonCode: z.enum([
    "synthetic_prerequisite_review",
    "synthetic_completed",
    "synthetic_no_show",
    "synthetic_participant_change",
    "local_prerequisite_review",
    "local_completed",
    "local_no_show",
    "local_participant_change",
  ]),
});
export const workflowMove = workflowChange.extend({
  startAtUtc: instant,
  endAtUtc: instant,
  displayTimezone: z.string().refine(isValidTimeZone),
});
export type WorkflowAction =
  "confirm" | "cancel" | "reschedule" | "complete" | "no_show";
