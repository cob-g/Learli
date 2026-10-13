import type { Metadata } from "next";
import { loadPrivateAccountPage } from "@/lib/permissions/workspace";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { readAdminSecurity } from "@/features/admin-security/state";
import { AdminSecurityForm } from "@/features/admin-security/security-form";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Administrator security",
  robots: { index: false, follow: false },
};
export default async function SecurityPage() {
  const state = await loadPrivateAccountPage(
    "/account/security",
    readAdminSecurity,
  );
  if (!state)
    return (
      <UnavailablePage
        title="Security access unavailable"
        message="Return to your account to check your access, or sign in again."
      />
    );
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Administrator security</h1>
      <p className="mt-4 max-w-prose text-body">
        {state.assured
          ? "Administrator verification is current. Your task permissions still determine which records and actions are available."
          : "Verify an authenticator or saved recovery code before viewing administrative records or taking administrative actions."}
      </p>
      <div className="mt-6 max-w-xl rounded-surface border border-border bg-surface p-6 sm:p-8">
        <h2 className="text-section-title">Authenticator and recovery</h2>
        <AdminSecurityForm enrolled={state.enrolled} />
      </div>
    </div>
  );
}
