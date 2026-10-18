import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import type { AuthRuntime } from "@/lib/auth-factory";
import { getPrivateWorkflow } from "@/features/private-workflow/runtime";
import { requireIdentity } from "./access";
import { resolveLocalSyntheticSession } from "./local-synthetic-session";

/** Explicit ordinary/private composition selects transport and source scope.
 * Provider identity and final feature SQL remain the record authority. */
export async function resolveCoordinationSession(
  runtime: AuthRuntime,
  headers: Headers,
) {
  const privatePacket = getPrivateWorkflow(runtime);
  if (getLocalWorkflow(runtime)) {
    const identity = await requireIdentity(runtime, headers);
    return {
      userId: identity.userId,
      sessionId: identity.sessionId,
      localWorkflow: true,
    };
  }
  if (!privatePacket) return resolveLocalSyntheticSession(runtime, headers);
  const identity = await requireIdentity(runtime, headers);
  return {
    userId: identity.userId,
    sessionId: identity.sessionId,
    privateWorkflow: true,
    privatePacket,
  };
}
