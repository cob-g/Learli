import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDomainAuthRuntime, getAccountAuthRuntime } from "../auth";
import type { AuthRuntime } from "../auth-factory";
import { accountHeadersAllowed } from "@/features/hosted-auth/request";
import type { Role } from "../db/schema";
import { AccessError, requireIdentity } from "./access";
import { recheckAdminAssurance } from "@/features/admin-security/assurance";
import { readAccount } from "@/features/account/service";

/**
 * Runs a guarded read for a private page. Anonymous visitors go to sign-in with
 * a return path. Every other refusal or failure yields null, so the page shows
 * one identical unavailable state and reveals nothing about the record.
 */
export async function loadPrivatePage<T>(
  path: string,
  load: (runtime: AuthRuntime, headers: Headers) => Promise<T>,
): Promise<T | null> {
  // Enrollment is ordinary verified admin identity, so denial must not create a
  // redirect loop through the admin-assurance guard. No domain data is loaded.
  // The pre-check and the page's own guard share one identity and assurance
  // read per render (see requireIdentity), so this costs no extra queries.
  const requestHeaders = await headers();
  if (path === "/admin" || path.startsWith("/admin/")) {
    const runtime = await getDomainAuthRuntime();
    if (runtime) {
      let needsAssurance = false;
      try {
        const identity = await requireIdentity(runtime, requestHeaders);
        if (identity.roles.includes("admin"))
          await recheckAdminAssurance(runtime.db, identity).catch(
            (error: unknown) => {
              needsAssurance =
                error instanceof AccessError && error.status === 403;
            },
          );
      } catch {
        /* The normal guarded load reports unavailable or sign-in. */
      }
      if (needsAssurance) redirect("/account/security");
    }
  }
  try {
    const runtime = await getDomainAuthRuntime();
    if (!runtime) return null;
    return await load(runtime, requestHeaders);
  } catch (error) {
    if (error instanceof AccessError && error.status === 401)
      redirect(`/sign-in?next=${encodeURIComponent(path)}`);
    return null;
  }
}
export type ShellAccount = {
  id: string;
  name: string;
  roles: Role[];
  sessionId: string;
};
/**
 * Bind the private document independently of the optional display account.
 * Pages share requireIdentity's per-render read; the extra query only supplies
 * the shell's name. A failed display query must not discard a proven identity
 * while separately guarded page children can still contain that user's data.
 * Every page and endpoint retains its own authorization guard.
 */
export async function readWorkspaceDocument(): Promise<{
  identity: { id: string; sessionId: string } | null;
  account: ShellAccount | null;
}> {
  const unavailable = { identity: null, account: null };
  const requestHeaders = await headers();
  try {
    const runtime = await getAccountAuthRuntime();
    if (!runtime || !accountHeadersAllowed(runtime, requestHeaders))
      return unavailable;
    const identity = await requireIdentity(runtime, requestHeaders);
    let account: ShellAccount | null = null;
    try {
      const display = await readAccount(runtime, requestHeaders);
      account = {
        id: display.id,
        name: display.name,
        roles: display.roles,
        sessionId: identity.sessionId,
      };
    } catch {
      // Chrome may retry; the document remains bound to the server identity.
    }
    return {
      identity: { id: identity.userId, sessionId: identity.sessionId },
      account,
    };
  } catch {
    return unavailable;
  }
}
export async function loadPrivateAccountPage<T>(
  path: string,
  load: (runtime: AuthRuntime, headers: Headers) => Promise<T>,
): Promise<T | null> {
  try {
    const runtime = await getAccountAuthRuntime();
    const requestHeaders = await headers();
    if (!runtime || !accountHeadersAllowed(runtime, requestHeaders))
      return null;
    return await load(runtime, requestHeaders);
  } catch (error) {
    if (error instanceof AccessError && error.status === 401)
      redirect(`/sign-in?next=${encodeURIComponent(path)}`);
    return null;
  }
}
