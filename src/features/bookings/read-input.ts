import { z } from "zod";

export const bookingReadScope = z.enum(["student", "guardian", "tutor"]);
const pagination = {
  scope: bookingReadScope,
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  learnerId: z.uuid().optional(),
};
export const bookingListInput = z
  .strictObject({
    ...pagination,
    filter: z.enum(["all", "active", "history"]).default("all"),
  })
  .refine((value) => value.scope !== "tutor" || !value.learnerId);
export const bookingOverviewInput = z
  .strictObject(pagination)
  .refine((value) => value.scope !== "tutor" || !value.learnerId);
export type BookingListInput = z.infer<typeof bookingListInput>;
