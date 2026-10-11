import { z } from "zod";
import { isValidTimeZone } from "@/lib/time/time-zone";

/** An IANA identifier Learli schedules against. Offsets such as +08:00 are rejected. */
export const timeZoneSchema = z.string().refine(isValidTimeZone);
