import type { Metadata } from "next";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { AccountForm } from "@/features/account/account-form";
import { readAccount } from "@/features/account/service";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { AccessError } from "@/lib/permissions/access";
import { loadPrivateAccountPage } from "@/lib/permissions/workspace";
import { listTimeZoneOptions } from "@/lib/time/zones";
import "@/features/account/account-settings-cards.css";
import "@/features/parent-children/parent-pages.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Parent Profile",
  robots: { index: false, follow: false },
};

export default async function ParentProfilePage() {
  const account = await loadPrivateAccountPage(
    "/parent/profile",
    async (runtime, headers) => {
      const account = await readAccount(runtime, headers);
      if (!account.roles.includes("parent")) throw new AccessError(403);
      return account;
    },
  );
  if (!account)
    return (
      <UnavailablePage
        title="Parent profile unavailable"
        message="We cannot open a parent profile on this account. Return to your account or check your sign-in status."
      />
    );
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">Parent workspace</p>
          <h1>Parent Profile</h1>
          <p className="wrap-anywhere">Registered email: {account.email}</p>
          <p className="mt-2 text-small text-muted-foreground">
            Parent or guardian workspace. Update your display name and time zone
            below.
          </p>
        </div>
      </header>
      <section
        className="account-panel max-w-3xl"
        aria-labelledby="parent-profile-settings"
      >
        <div className="account-panel-head">
          <span className="account-panel-icon" aria-hidden="true">
            <UserRound size={20} />
          </span>
          <h2 id="parent-profile-settings">Profile details</h2>
        </div>
        <AccountForm
          account={account}
          timeZones={listTimeZoneOptions(new Date(), [account.timezone])}
          panel
        />
      </section>
      <nav aria-label="Parent profile actions" className="pp-actions">
        <Link
          className="action action-primary pp-submit"
          href="/parent/children"
        >
          My Children
        </Link>
        <Link className="pp-link" href="/account">
          Account settings and security
        </Link>
      </nav>
    </div>
  );
}
