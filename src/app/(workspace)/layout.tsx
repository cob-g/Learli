import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import "@/components/workspace/workspace-shell.css";
import { PrivateDocumentBoundary } from "@/features/auth/document-boundary";
import { getAuthRuntime } from "@/lib/auth";
import { getScreeningContext } from "@/features/tutor-screening/composition";
import { readShellAccount } from "@/lib/permissions/workspace";
import { noIndex } from "@/lib/seo/metadata";

// Every workspace page also says this itself; the layout covers any that forgets.
export const metadata: Metadata = { robots: noIndex };

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read on the server so the first paint already has the full sidebar.
  const initialAccount = await readShellAccount();
  // Same deployment-level decision the screening page makes; it is not per user.
  const runtime = getAuthRuntime();
  const screeningEnabled =
    !!runtime && getScreeningContext(runtime).screening.mode !== "disabled";
  return (
    <PrivateDocumentBoundary>
      <WorkspaceShell
        initialAccount={initialAccount}
        screeningEnabled={screeningEnabled}
      >
        {children}
      </WorkspaceShell>
    </PrivateDocumentBoundary>
  );
}
