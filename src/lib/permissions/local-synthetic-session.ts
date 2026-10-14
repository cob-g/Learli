// Node-only preflight; plain Node services/tests also consume this module.
import type { AuthRuntime } from "@/lib/auth-factory";
import { isLoopbackOrigin, syntheticEmail } from "@/lib/local-mode";
import { AccessError } from "./access";

export async function resolveLocalSyntheticSession(
  runtime: AuthRuntime,
  headers: Headers,
) {
  if (
    !["development", "test"].includes(runtime.environment) ||
    !isLoopbackOrigin(runtime.origin)
  )
    throw new AccessError(503);
  const current = await runtime.auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
  });
  if (!current) throw new AccessError(401);
  if (!syntheticEmail(current.user.email)) throw new AccessError(404);
  // Only provider-owned IDs leave preflight. Feature SQL remains final authority.
  return { userId: current.user.id, sessionId: current.session.id };
}
