import type { Metadata } from "next";
import { PublicShell } from "@/components/shared/public-shell";
import { PublicAuthDocumentBoundary } from "@/features/auth/document-boundary";
import { noIndex } from "@/lib/seo/metadata";

// Account access is never a search result, in any environment.
export const metadata: Metadata = { robots: noIndex };

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicAuthDocumentBoundary>
      <PublicShell>{children}</PublicShell>
    </PublicAuthDocumentBoundary>
  );
}
