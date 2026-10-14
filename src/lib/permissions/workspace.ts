import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthRuntime, getAccountAuthRuntime } from "../auth";
import type { AuthRuntime, DevelopmentAuthRuntime } from "../auth-factory";
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
  load: (runtime: DevelopmentAuthRuntime, headers: Headers) => Promise<T>,
): Promise<T | null> {
  // Enrollment is ordinary verified admin identity, so denial must not create a
  // redirect loop through the admin-assurance guard. No domain data is loaded.
  // The pre-check and the page's own guard share one identity and assurance
  // read per render (see requireIdentity), so this costs no extra queries.
  const requestHeaders = await headers();
  if (path === "/admin" || path.startsWith("/admin/")) {
    const runtime = getAuthRuntime();
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
    const runtime = getAuthRuntime();
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
 * The account the workspace shell shows on its first render, read the same
 * guarded way as GET /api/account/[userId]. Pages already read the identity in
 * this render, so it costs one name query. Null on any refusal or failure; the
 * shell then falls back to its own client checks. Display only: every page and
 * endpoint keeps its own guard.
 */
export async function readShellAccount(): Promise<ShellAccount | null> {
  const requestHeaders = await headers();
  try {
    const runtime = await getAccountAuthRuntime();
    if (!runtime || !accountHeadersAllowed(runtime, requestHeaders))
      return null;
    const identity = await requireIdentity(runtime, requestHeaders);
    const account = await readAccount(runtime, requestHeaders);
    return {
      id: account.id,
      name: account.name,
      roles: account.roles,
      sessionId: identity.sessionId,
    };
  } catch {
    return null;
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
