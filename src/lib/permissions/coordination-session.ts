import type { AuthRuntime } from "@/lib/auth-factory";
import { getPrivateWorkflow } from "@/features/private-workflow/runtime";
import { requireIdentity } from "./access";
import { resolveLocalSyntheticSession } from "./local-synthetic-session";

/** Explicit private composition broadens transport, never record authority.
 * The provider validates ingress/membership; final feature SQL rechecks access. */
export async function resolveCoordinationSession(
  runtime: AuthRuntime,
  headers: Headers,
) {
  const privatePacket = getPrivateWorkflow(runtime);
  if (!privatePacket) return resolveLocalSyntheticSession(runtime, headers);
  const identity = await requireIdentity(runtime, headers);
  return {
    userId: identity.userId,
    sessionId: identity.sessionId,
    privateWorkflow: true,
    privatePacket,
  };
}
