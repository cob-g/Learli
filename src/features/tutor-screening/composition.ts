import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { getPrivateWorkflow } from "@/features/private-workflow/runtime";
import type { AuthRuntime } from "@/lib/auth-factory";
import {
  disabledScreening,
  localScreeningPolicy,
  validateScreeningCapability,
} from "./policy";
import type { ScreeningContext } from "./service";
/** Select an explicit local or private receipt; SQL current heads remain authoritative. */
export function getScreeningContext(runtime: AuthRuntime): ScreeningContext {
  return {
    runtime,
    screening: getLocalWorkflow(runtime)
      ? validateScreeningCapability(localScreeningPolicy, "development")
      : (getPrivateWorkflow(runtime)?.screening ?? disabledScreening),
  };
}
