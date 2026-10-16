import type { ReactNode } from "react";
import { getServerEnv } from "@/lib/env/server";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { getAccountAuthRuntime } from "@/lib/auth";
import { headers } from "next/headers";
import { accountHeadersAllowed } from "@/features/hosted-auth/request";

export async function AuthFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const mode = getServerEnv().AUTH_MODE;
  let available = mode === "local";
  if (mode === "hosted-synthetic") {
    try {
      const runtime = await getAccountAuthRuntime();
      available = !!runtime && accountHeadersAllowed(runtime, await headers());
    } catch {
      available = false;
    }
  }
  if (!available)
    return (
      <UnavailablePage
        title="Accounts are not open yet"
        message="Account access is unavailable. Try again later."
      />
    );
  return (
    <div className="page-shell page-space">
      <div className="mx-auto max-w-xl">
        <h1 className="text-page-title">{title}</h1>
        <div className="mt-6 rounded-surface border border-border bg-surface p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
