import { PublicAuthDocumentBoundary } from "@/features/auth/document-boundary";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicAuthDocumentBoundary>{children}</PublicAuthDocumentBoundary>;
}
