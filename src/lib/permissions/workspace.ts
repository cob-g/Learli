import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthRuntime } from "../auth";
import type { AuthRuntime } from "../auth-factory";
import { AccessError } from "./access";

/**
 * Runs a guarded read for a private page. Anonymous visitors go to sign-in with
 * a return path. Every other refusal or failure yields null, so the page shows
 * one identical unavailable state and reveals nothing about the record.
 */
export async function loadPrivatePage<T>(
  path: string,
  load: (runtime: AuthRuntime, headers: Headers) => Promise<T>,
): Promise<T | null> {
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
