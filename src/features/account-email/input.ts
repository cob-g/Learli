import { z } from "zod";
import { syntheticEmail } from "@/lib/local-mode";

const newEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email())
  .refine(syntheticEmail);
const code = z.string().regex(/^\d{6}$/);
export const emailChangeInput = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("start") }),
  z.strictObject({ action: z.literal("request"), newEmail, code }),
  z.strictObject({ action: z.literal("confirm"), newEmail, code }),
]);
export type EmailChangeInput = z.infer<typeof emailChangeInput>;
