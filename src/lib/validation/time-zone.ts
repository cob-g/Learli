import { z } from "zod";

/** An IANA identifier this runtime knows. Offsets such as +08:00 are rejected. */
export const timeZoneSchema = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(value)) return false;
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  });
