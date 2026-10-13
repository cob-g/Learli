import type { Metadata } from "next";
import Link from "next/link";
import { loadPrivateAccountPage } from "@/lib/permissions/workspace";
import { requireIdentity } from "@/lib/permissions/access";
import { SessionList } from "@/features/account-sessions/session-list";
import { SignOut } from "@/features/auth/sign-out";
import { UnavailablePage } from "@/components/shared/unavailable-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Account sessions",
  robots: { index: false, follow: false },
};

export default async function AccountSessionsPage() {
  const identity = await loadPrivateAccountPage(
    "/account/sessions",
    requireIdentity,
  );
  if (!identity)
    return (
      <UnavailablePage
        title="Account sessions unavailable"
        message="Your account sessions cannot be opened right now. Check your sign-in status or try again later."
      />
    );
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Account sessions</h1>
      <p className="mt-4 max-w-prose text-body">
        Review your active synthetic test sessions and sign out any other
        session you no longer use.
      </p>
      <SessionList />
      <SignOut />
      <Link className="mt-8 inline-flex min-h-11 items-center" href="/account">
        Account settings
      </Link>
    </div>
  );
}
