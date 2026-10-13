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
        message="Account testing is unavailable. Try again later."
      />
    );
  return (
    <div className="page-shell page-space">
      <div className="max-w-prose">
        <h1 className="text-page-title">{title}</h1>
        <p className="mt-4 text-body text-muted-foreground">
          {mode === "local"
            ? "Local testing only. Use a made-up name and an email ending in .test. Messages stay in your local mailbox."
            : "Hosted synthetic testing only. Use an explicitly configured fictional account. Message requests do not establish delivery or real account eligibility."}
        </p>
        {children}
      </div>
    </div>
  );
}
