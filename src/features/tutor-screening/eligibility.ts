import { sql, type SQL } from "drizzle-orm";
import type { ScreeningScope } from "./policy";

/** Compose with approved profile, active verified account, tutor role and offering. */
export function screeningEligibilityPredicate(
  tutorId: SQL | string,
  scope: ScreeningScope = "local_demo",
): SQL {
  if (scope !== "local_demo" && scope !== "synthetic_readiness")
    return sql`false`;
  return sql`public.has_current_tutor_screening(${tutorId}, ${scope})`;
}
