import { PrivateDocumentBoundary } from "@/features/auth/document-boundary";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PrivateDocumentBoundary>{children}</PrivateDocumentBoundary>;
}
