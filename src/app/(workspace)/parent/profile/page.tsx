import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/features/account/account-form";
import { readAccount } from "@/features/account/service";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { AccessError } from "@/lib/permissions/access";
import { loadPrivateAccountPage } from "@/lib/permissions/workspace";
import { listTimeZoneOptions } from "@/lib/time/zones";

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
    <div className="page-shell page-space">
      <div className="max-w-3xl">
        <h1 className="text-page-title">Parent Profile</h1>
        <p className="mt-4 text-body wrap-anywhere">
          Registered email: {account.email}
        </p>
        <p className="mt-2 text-small text-muted-foreground">
          Parent or guardian workspace. Update your display name and time zone
          below.
        </p>
        <section
          className="mt-8 rounded-surface border border-border bg-surface p-6 sm:p-8"
          aria-labelledby="parent-profile-settings"
        >
          <h2 id="parent-profile-settings" className="text-section-title">
            Profile details
          </h2>
          <AccountForm
            account={account}
            timeZones={listTimeZoneOptions(new Date(), [account.timezone])}
          />
        </section>
        <nav
          aria-label="Parent profile actions"
          className="mt-8 flex flex-wrap items-center gap-6"
        >
          <Link className="action action-primary" href="/parent/children">
            My Children
          </Link>
          <Link className="inline-flex min-h-11 items-center" href="/account">
            Account settings and security
          </Link>
        </nav>
      </div>
    </div>
  );
}
