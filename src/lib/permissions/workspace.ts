import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthRuntime, getAccountAuthRuntime } from "../auth";
import type { AuthRuntime, DevelopmentAuthRuntime } from "../auth-factory";
import { accountHeadersAllowed } from "@/features/hosted-auth/request";
import { AccessError, requireIdentity } from "./access";
import { readAdminSecurity } from "@/features/admin-security/state";

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
  if (path === "/admin" || path.startsWith("/admin/")) {
    const runtime = getAuthRuntime();
    if (runtime) {
      const requestHeaders = await headers();
      let needsAssurance = false;
      try {
        const identity = await requireIdentity(runtime, requestHeaders);
        if (identity.roles.includes("admin"))
          needsAssurance = !(await readAdminSecurity(runtime, requestHeaders))
            .assured;
      } catch {
        /* The normal guarded load reports unavailable or sign-in. */
      }
      if (needsAssurance) redirect("/account/security");
    }
  }
  try {
    const runtime = getAuthRuntime();
    if (!runtime) return null;
    return await load(runtime, await headers());
  } catch (error) {
    if (error instanceof AccessError && error.status === 401)
      redirect(`/sign-in?next=${encodeURIComponent(path)}`);
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
