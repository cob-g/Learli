import type { Metadata } from "next";
import { PublicShell } from "@/components/shared/public-shell";
import { PublicAuthDocumentBoundary } from "@/features/auth/document-boundary";
import { noIndex } from "@/lib/seo/metadata";
import { AuthFooter } from "@/features/auth/auth-footer";
import { SignUpFooter } from "@/features/auth/sign-up-footer";
import { SiteFooter } from "@/components/shared/site-footer";

// Account access is never a search result, in any environment.
export const metadata: Metadata = { robots: noIndex };

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicAuthDocumentBoundary>
      <PublicShell
        footer={
          <AuthFooter
            signUpFooter={<SignUpFooter />}
            defaultFooter={<SiteFooter />}
          />
        }
      >
        {children}
      </PublicShell>
    </PublicAuthDocumentBoundary>
  );
}
