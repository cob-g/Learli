import type { Metadata } from "next";
import { AdmissionReviewEntry } from "@/features/learner-admission/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/permissions/access";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readAccount } from "@/features/account/service";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { getPrivateWorkflow } from "@/features/private-workflow/runtime";
import { AdminShell } from "@/features/admin/admin-shell";
import { SignOut } from "@/features/auth/sign-out";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin workspace",
  robots: { index: false, follow: false },
};
export default async function AdminWorkspacePage() {
  const result = await loadPrivatePage("/admin", async (runtime, headers) => {
    await requireRole(runtime, headers, "admin");
    return {
      account: await readAccount(runtime, headers),
      privateWorkflow: getPrivateWorkflow(runtime) !== null,
      localWorkflow: getLocalWorkflow(runtime) !== null,
    };
  });
  if (!result)
    return (
      <UnavailablePage
        title="Workspace access unavailable"
        message="This workspace is not available to your current account. Return to your account to see your assigned access."
      />
    );
  return (
    <AdminShell>
      <h1 className="text-page-title">Admin workspace</h1>
      <p className="mt-3 text-small wrap-anywhere text-muted-foreground">
        Signed in as {result.account.email}
      </p>
      <p className="mt-6 max-w-prose border-t border-border pt-6 text-body">
        {result.localWorkflow
          ? "Claim pending requests, review assigned tutor and learner information, maintain subjects, and confirm assigned bookings. Account support is limited to an exact authorized account."
          : result.privateWorkflow
            ? "Review assigned tutor and learner requests, maintain subjects, and open assigned booking tasks. Account controls require a separate exact grant and an owned local private test target."
            : "Review local tutor applications and manage the subject catalog. Support cases, account controls and private synthetic reviews require separately granted access to each relevant record."}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link className="inline-flex min-h-12 items-center" href="/account">
          Account settings
        </Link>
        {result.localWorkflow && (
          <Link className="action action-primary" href="/admin/requests">
            Unassigned reviews
          </Link>
        )}
        <AdmissionReviewEntry />
      </div>
      <SignOut />
    </AdminShell>
  );
}
