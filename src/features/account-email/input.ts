import { z } from "zod";
import { syntheticEmail } from "@/lib/local-mode";
import { mailboxSchema } from "@/lib/email/mailbox";

const newEmail = z.string().trim().toLowerCase().max(254).pipe(z.email());
const code = z.string().regex(/^\d{6}$/);
export function createEmailChangeInput(ordinary = false) {
  const address = ordinary
    ? newEmail.pipe(mailboxSchema)
    : newEmail.refine(syntheticEmail);
  return z.discriminatedUnion("action", [
    z.strictObject({ action: z.literal("start") }),
    z.strictObject({ action: z.literal("request"), newEmail: address, code }),
    z.strictObject({ action: z.literal("confirm"), newEmail: address, code }),
  ]);
}
export const emailChangeInput = createEmailChangeInput();
export type EmailChangeInput = z.infer<typeof emailChangeInput>;
