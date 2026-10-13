import { AuthFrame } from "@/features/auth/auth-frame";
import type { Metadata } from "next";
import { AdminSecurityForm } from "@/features/admin-security/security-form";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Verify administrator access",
  robots: { index: false, follow: false },
};
export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthFrame title="Verify administrator access">
      <p className="mt-4 text-body">
        Enter your authenticator code or a saved recovery code to finish signing
        in.
      </p>
      <AdminSecurityForm challenge next={next} />
    </AuthFrame>
  );
}
