import type { AuthRuntime } from "@/lib/auth-factory";
import { disabledSafeguarding } from "./policy";
import type { SafeguardingContext } from "./service";
/** No real intake is enabled by runtime mode, database records or admin role. */
export function getSafeguardingContext(
  runtime: AuthRuntime,
): SafeguardingContext {
  return { runtime, safeguarding: disabledSafeguarding };
}
