import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
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

// The sidebar's workspace label (owner's reference): Newsreader italic, only in
// workspaces. Exposed as --font-newsreader for workspace-shell.css.
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["italic"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-newsreader",
  preload: false,
});

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
    // display: contents carries the font variable without adding a box.
    <div className={`contents ${newsreader.variable}`}>
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
    </div>
  );
}
