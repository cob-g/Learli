import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import "@/components/workspace/workspace-shell.css";
import "@/components/workspace/workspace-page.css";
import { PrivateDocumentBoundary } from "@/features/auth/document-boundary";
import { getDomainAuthRuntime } from "@/lib/auth";
import { getScreeningContext } from "@/features/tutor-screening/composition";
import { readWorkspaceDocument } from "@/lib/permissions/workspace";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { getPrivateWorkflow } from "@/features/private-workflow/runtime";
import { noIndex } from "@/lib/seo/metadata";

// Every workspace page also says this itself; the layout covers any that forgets.
export const metadata: Metadata = { robots: noIndex };

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read on the server so the first paint already has the full sidebar.
  const document = await readWorkspaceDocument();
  // Same deployment-level decision the screening page makes; it is not per user.
  const runtime = await getDomainAuthRuntime();
  const privatePacket = runtime ? getPrivateWorkflow(runtime) : null;
  const localWorkflow = !!runtime && getLocalWorkflow(runtime) !== null;
  const screeningEnabled =
    !!runtime && getScreeningContext(runtime).screening.mode !== "disabled";
  return (
    <PrivateDocumentBoundary initialIdentity={document.identity}>
      <WorkspaceShell
        initialAccount={document.account}
        screeningEnabled={screeningEnabled}
        privateWorkflow={privatePacket !== null || localWorkflow}
        privateAccounts={
          privatePacket?.database.mode === "local-test" || localWorkflow
        }
        localWorkflow={localWorkflow}
      >
        {children}
      </WorkspaceShell>
    </PrivateDocumentBoundary>
  );
}
