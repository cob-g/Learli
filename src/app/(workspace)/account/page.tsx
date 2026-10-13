import type { Metadata } from "next";
import { AdmissionEntry } from "@/features/learner-admission/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAccountAuthRuntime } from "@/lib/auth";
import { AccessError } from "@/lib/permissions/access";
import { readAccount } from "@/features/account/service";
import { AccountForm } from "@/features/account/account-form";
import { PasswordForm } from "@/features/account-password/password-form";
import { SignOut } from "@/features/auth/sign-out";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { listTimeZoneOptions } from "@/lib/time/zones";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};
export default async function AccountPage() {
  let account;
  try {
    const runtime = await getAccountAuthRuntime();
    if (!runtime) throw new AccessError(503);
    account = await readAccount(runtime, await headers());
  } catch (error) {
    if (error instanceof AccessError && error.status === 401)
      redirect("/sign-in?next=%2Faccount");
    return (
      <UnavailablePage
        title="Account access unavailable"
        message="Your account cannot be opened right now. Check your sign-in status or try again later."
      />
    );
  }
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Your account</h1>
      <p className="mt-4 text-body">Signed in as {account.email}</p>
      <p className="mt-2 max-w-prose text-body text-muted-foreground">
        This is a synthetic test account. Real lessons are not available here.
      </p>
      {account.roles.length ? (
        <nav
          aria-label="Your workspaces"
          className="mt-4 flex flex-wrap gap-x-6 gap-y-2"
        >
          {account.roles.map((role) => (
            <Link
              className="inline-flex min-h-11 items-center"
              key={role}
              href={`/${role}`}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)} workspace
            </Link>
          ))}
        </nav>
      ) : (
        <p className="mt-4 text-body">
          No workspace role has been assigned to this account.
        </p>
      )}
      <AdmissionEntry />
      <AccountForm
        account={account}
        timeZones={listTimeZoneOptions(new Date(), [account.timezone])}
      />
      {account.roles.includes("admin") && (
        <Link
          className="mt-8 inline-flex min-h-11 items-center"
          href="/account/security"
        >
          Administrator security
        </Link>
      )}
      <PasswordForm />
      <Link
        className="me-6 mt-8 inline-flex min-h-11 items-center"
        href="/account/email"
      >
        Change account email
      </Link>
      <Link
        className="mt-8 inline-flex min-h-11 items-center"
        href="/account/sessions"
      >
        Manage account sessions
      </Link>
      <SignOut />
    </div>
  );
}
