// Server-only by import boundary: routes/tests only; client imports model types.
import { isAPIError } from "better-auth/api";
import type { AuthRuntime } from "@/lib/auth-factory";
import { AccessError, requireIdentity } from "@/lib/permissions/access";
import { RuleError } from "@/lib/rule-error";
import { providerHeaders } from "@/features/hosted-auth/request";
import {
  reportedDevice,
  revokeSessionInput,
  type AccountSession,
} from "./model";

export class SessionFreshnessError extends RuleError {
  constructor() {
    super(403, "Sign out, then sign in again to manage your sessions.");
  }
}

async function ownProviderSessions(runtime: AuthRuntime, headers: Headers) {
  const identity = await requireIdentity(runtime, headers);
  if ("hosted" in runtime) headers = providerHeaders(runtime, headers);
  const current = await runtime.auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
  });
  if (!current || current.user.id !== identity.userId)
    throw new AccessError(401);
  try {
    // Installed 1.7.7 requires a fresh session for this supported list API.
    const sessions = await runtime.auth.api.listSessions({ headers });
    return {
      currentId: current.session.id,
      // Provider also scopes this query; retain an explicit projection boundary.
      sessions: sessions.filter(
        (session) =>
          session.userId === identity.userId && session.expiresAt > new Date(),
      ),
    };
  } catch (error) {
    if (isAPIError(error) && error.body?.code === "SESSION_NOT_FRESH")
      throw new SessionFreshnessError();
    if (isAPIError(error) && error.statusCode === 401)
      throw new AccessError(401);
    throw error;
  }
}

export async function listAccountSessions(
  runtime: AuthRuntime,
  headers: Headers,
): Promise<AccountSession[]> {
  const { currentId, sessions } = await ownProviderSessions(runtime, headers);
  return sessions
    .sort(
      (a, b) =>
        Number(b.id === currentId) - Number(a.id === currentId) ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    )
    .map((session) => ({
      id: session.id,
      current: session.id === currentId,
      reportedDevice: reportedDevice(session.userAgent),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    }));
}

export async function revokeOtherAccountSession(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown,
) {
  const { currentId, sessions } = await ownProviderSessions(runtime, headers);
  const { sessionId } = revokeSessionInput.parse(input);
  if (sessionId === currentId)
    throw new RuleError(409, "Use Sign out to end your current session.");
  const target = sessions.find((session) => session.id === sessionId);
  if (!target) throw new RuleError(404, "That session is not available.");
  // The provider re-reads the authoritative caller and checks target ownership.
  // No token crosses the server boundary; we do not manage/delete auth rows.
  try {
    await runtime.auth.api.revokeSession({
      headers,
      body: { token: target.token },
    });
  } catch (error) {
    if (isAPIError(error) && error.statusCode === 401)
      throw new AccessError(401);
    throw error;
  }
  return { status: true };
}
