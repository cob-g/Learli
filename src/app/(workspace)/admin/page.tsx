import type { Metadata } from "next";
import { requireRole } from "@/lib/permissions/access";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readAccount } from "@/features/account/service";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { getPrivateWorkflow } from "@/features/private-workflow/runtime";
import { AdminOverview } from "@/features/admin/admin-overview";
import { workspaceLinks } from "@/components/workspace/navigation";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin workspace",
  robots: { index: false, follow: false },
};
export default async function AdminWorkspacePage() {
  const result = await loadPrivatePage("/admin", async (runtime, headers) => {
    await requireRole(runtime, headers, "admin");
    const privatePacket = getPrivateWorkflow(runtime);
    const localWorkflow = getLocalWorkflow(runtime) !== null;
    return {
      account: await readAccount(runtime, headers),
      privateWorkflow: privatePacket !== null,
      localWorkflow,
      // Same deployment switches the workspace layout gives the sidebar.
      links: workspaceLinks("admin", {
        privateWorkflow: privatePacket !== null || localWorkflow,
        privateAccounts:
          privatePacket?.database.mode === "local-test" || localWorkflow,
        localWorkflow,
      }),
    };
  });
  if (!result)
    return (
      <UnavailablePage
        title="Workspace access unavailable"
        message="This workspace is not available to your current account. Return to your account to see your assigned access."
      />
    );
  const [summary, scope] = result.localWorkflow
    ? [
        "Claim exceptional review work, review assigned Tutor screening and retained learner review records, maintain subjects, and confirm assigned bookings.",
        "Account support is limited to an exact authorized account.",
      ]
    : result.privateWorkflow
      ? [
          "Review assigned tutor and learner requests, maintain subjects, and open assigned booking tasks.",
          "Account controls require a separate exact grant and an owned local private test target.",
        ]
      : [
          "Review local tutor applications and manage the subject catalog.",
          "Support cases, account controls and private synthetic reviews require separately granted access to each relevant record.",
        ];
  return (
    <AdminOverview
      email={result.account.email}
      summary={summary}
      scope={scope}
      links={result.links}
      localWorkflow={result.localWorkflow}
    />
  );
}
