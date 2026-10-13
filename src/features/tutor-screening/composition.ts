import type { AuthRuntime } from "@/lib/auth-factory";
import { disabledScreening } from "./policy";
import type { ScreeningContext } from "./service";
/** Shipped new screening workflows are disabled. Test-owned mirror overrides this factory only. */
export function getScreeningContext(runtime: AuthRuntime): ScreeningContext {
  return { runtime, screening: disabledScreening };
}
