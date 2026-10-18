import type { AuthRuntime } from "@/lib/auth-factory";
import { isPrivateWorkflow } from "@/features/private-workflow/runtime";
import { getLocalWorkflow } from "./runtime";

/** Route/presentation choice only. Policies and exact SQL authority own access. */
export function hasPersistentWorkflow(runtime: AuthRuntime) {
  return getLocalWorkflow(runtime) !== null || isPrivateWorkflow(runtime);
}
