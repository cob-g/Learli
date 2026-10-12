import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/permissions/access";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readAccount } from "@/features/account/service";
import { AdminShell } from "@/features/admin/admin-shell";
import { SignOut } from "@/features/auth/sign-out";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin workspace",
  robots: { index: false, follow: false },
};
export default async function AdminWorkspacePage() {
  const account = await loadPrivatePage("/admin", async (runtime, headers) => {
    await requireRole(runtime, headers, "admin");
    return readAccount(runtime, headers);
  });
  if (!account)
    return (
      <UnavailablePage
        title="Workspace access unavailable"
        message="This workspace is not available to your current account. Return to your account to see your assigned access."
      />
    );
  return (
    <AdminShell>
      <h1 className="text-page-title">Admin workspace</h1>
      <p className="mt-4 text-body">Signed in as {account.email}</p>
      <p className="mt-4 max-w-prose text-body text-muted-foreground">
        Review local tutor applications and manage the subject catalog. Support
        cases, account controls and private synthetic reviews require separately
        granted access to each relevant record.
      </p>
      <Link className="mt-4 inline-flex min-h-11 items-center" href="/account">
        Account settings
      </Link>
      <SignOut />
    </AdminShell>
  );
}
