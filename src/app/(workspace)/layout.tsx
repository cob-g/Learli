import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import "@/components/workspace/workspace-shell.css";
import { PrivateDocumentBoundary } from "@/features/auth/document-boundary";
import { noIndex } from "@/lib/seo/metadata";

// Every workspace page also says this itself; the layout covers any that forgets.
export const metadata: Metadata = { robots: noIndex };

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PrivateDocumentBoundary>
      <WorkspaceShell>{children}</WorkspaceShell>
    </PrivateDocumentBoundary>
  );
}
