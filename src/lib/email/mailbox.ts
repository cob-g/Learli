import { z } from "zod";

export const mailboxSchema = z
  .string()
  .max(254)
  .email()
  .regex(/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+$/)
  .refine((value) => !value.includes(".."));
