import { z } from "zod";

export const passwordChangeInput = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128),
  })
  .strict()
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Enter the same new password in both fields.",
  });

export type PasswordChangeInput = z.infer<typeof passwordChangeInput>;
