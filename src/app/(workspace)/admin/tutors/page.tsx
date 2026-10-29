import type { Metadata } from "next";
import { reviewStatuses } from "@/lib/db/schema/app";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readAccount } from "@/features/account/service";
import { AdminTutorQueue } from "@/features/admin/admin-tutor-queue";
import { listTutorApplications } from "@/features/tutors/review";
import { safePage } from "@/features/support/input";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { getPrivateWorkflow } from "@/features/private-workflow/runtime";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Tutor applications",
  robots: { index: false, follow: false },
};
export default async function TutorReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const requested = params.status ?? "pending";
  const requestedPage = safePage(params.page);
  // An unknown value falls back to the working queue instead of an error.
  const status =
    requested === "all"
      ? undefined
      : (reviewStatuses.find((value) => value === requested) ?? "pending");
  const data = await loadPrivatePage(
    "/admin/tutors",
    async (runtime, headers) => ({
      queue: await listTutorApplications(
        runtime,
        headers,
        status,
        requestedPage,
      ),
      account: await readAccount(runtime, headers),
      localWorkflow: getLocalWorkflow(runtime) !== null,
      privateWorkflow: getPrivateWorkflow(runtime) !== null,
    }),
  );
  if (!data)
    return (
      <UnavailablePage
        title="Workspace access unavailable"
        message="This workspace is not available to your current account. Return to your account to see your assigned access."
      />
    );
  const { total, applications, page, hasMore } = data.queue;
  return (
    <AdminTutorQueue
      intro={
        data.localWorkflow
          ? "Current Identity and Eligibility checks are required before approval and public eligibility. Real-launch criteria and any external screening provider remain unapproved."
          : data.privateWorkflow
            ? "Fictional test data only. Current required checks and the application decision both affect public eligibility."
            : "Review assigned Tutor applications and their current screening state. Approval alone does not guarantee public eligibility."
      }
      status={status}
      applications={applications}
      total={total}
      page={page}
      hasMore={hasMore}
      timezone={data.account.timezone}
    />
  );
}
