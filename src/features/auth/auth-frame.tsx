import type { ReactNode } from "react";
import { getServerEnv } from "@/lib/env/server";
import { UnavailablePage } from "@/components/shared/unavailable-page";

export function AuthFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  if (getServerEnv().AUTH_MODE !== "local")
    return (
      <UnavailablePage
        title="Accounts are not open yet"
        message="Local account testing has not been configured."
      />
    );
  return (
    <div className="page-shell page-space">
      <div className="max-w-prose">
        <h1 className="text-page-title">{title}</h1>
        <p className="mt-4 text-body text-muted-foreground">
          Local testing only. Use a made-up name and an email ending in .test.
          Messages stay in your local mailbox.
        </p>
        {children}
      </div>
    </div>
  );
}
