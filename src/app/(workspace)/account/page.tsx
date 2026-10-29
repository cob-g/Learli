import type { Metadata } from "next";
import { AdmissionEntry } from "@/features/learner-admission/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAccountAuthRuntime, getDomainAuthRuntime } from "@/lib/auth";
import { canOpenStudentWorkspace } from "@/features/student-onboarding/read";
import { AccessError } from "@/lib/permissions/access";
import { readAccount } from "@/features/account/service";
import { AccountForm } from "@/features/account/account-form";
import { PasswordForm } from "@/features/account-password/password-form";
import { SignOut } from "@/features/auth/sign-out";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { listTimeZoneOptions } from "@/lib/time/zones";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { AccountSettingsCards } from "@/features/account/account-settings-cards";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};
export default async function AccountPage() {
  let account;
  let studentReady = false;
  let localWorkflow = false;
  try {
    const runtime = await getAccountAuthRuntime();
    if (!runtime) throw new AccessError(503);
    const requestHeaders = await headers();
    localWorkflow = getLocalWorkflow(runtime) !== null;
    account = await readAccount(runtime, requestHeaders);
    if (account.roles.includes("student")) {
      try {
        const domain = await getDomainAuthRuntime();
        studentReady =
          !!domain && (await canOpenStudentWorkspace(domain, requestHeaders));
      } catch {
        // Account settings remain available when learner authority cannot be proven.
      }
    }
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
  const workspaceRoles = account.roles.filter(
    (role) => role !== "student" || studentReady,
  );
  // Roles moved to the redesigned workspaces so far get the card layout.
  if (account.roles.includes("admin") || account.roles.includes("tutor"))
    return (
      <AccountSettingsCards
        account={account}
        timeZones={listTimeZoneOptions(new Date(), [account.timezone])}
        workspaceRoles={workspaceRoles}
        localWorkflow={localWorkflow}
      />
    );
  return (
    <div className="page-shell page-space">
      <div className="max-w-5xl">
        <h1 className="text-page-title">Your account</h1>
        <p className="mt-4 text-body wrap-anywhere">
          Signed in as {account.email}
        </p>
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <section
              aria-labelledby="account-profile-heading"
              className="rounded-surface border border-border bg-surface p-6 sm:p-8"
            >
              <h2 id="account-profile-heading" className="text-section-title">
                Profile settings
              </h2>
              <AccountForm
                account={account}
                timeZones={listTimeZoneOptions(new Date(), [account.timezone])}
              />
            </section>
            <PasswordForm />
          </div>
          <aside className="min-w-0 rounded-surface border border-border bg-surface p-6">
            <h2 className="text-item-title">Your workspaces</h2>
            {workspaceRoles.length ? (
              <nav
                aria-label="Your workspaces"
                className="mt-3 flex flex-col items-start gap-1"
              >
                {workspaceRoles.map((role) => (
                  <Link
                    className="inline-flex min-h-11 items-center"
                    key={role}
                    href={`/${role}`}
                  >
                    {role === "parent"
                      ? "Parent Dashboard"
                      : `${role.charAt(0).toUpperCase() + role.slice(1)} workspace`}
                  </Link>
                ))}
              </nav>
            ) : (
              <p className="mt-4 text-small text-muted-foreground">
                {account.roles.length
                  ? "No workspace with current access is available."
                  : "No workspace role has been assigned to this account."}
              </p>
            )}
            {!account.roles.includes("parent") && (
              <Link
                href="/parent/onboarding"
                className="mt-4 inline-flex min-h-11 items-center"
              >
                Set up parent workspace
              </Link>
            )}
            <Link
              href="/student/onboarding"
              className="mt-4 inline-flex min-h-11 items-center"
            >
              {account.roles.includes("student")
                ? "College Student setup and status"
                : "Set up College Student"}
            </Link>
            <AdmissionEntry localWorkflow={localWorkflow} />
            <section
              className="mt-6 border-t border-border pt-6"
              aria-labelledby="account-access-heading"
            >
              <h2 id="account-access-heading" className="text-item-title">
                Account access
              </h2>
              <nav
                aria-label="Account settings"
                className="mt-3 flex flex-col items-start gap-1"
              >
                <Link
                  className="inline-flex min-h-11 items-center"
                  href="/account/email"
                >
                  Change account email
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center"
                  href="/account/sessions"
                >
                  Manage account sessions
                </Link>
                {account.roles.includes("admin") && (
                  <Link
                    className="inline-flex min-h-11 items-center"
                    href="/account/security"
                  >
                    Administrator security
                  </Link>
                )}
              </nav>
              <SignOut />
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
