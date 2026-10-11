import type { Metadata } from "next";
import Link from "next/link";
import { reviewStatuses } from "@/lib/db/schema/app";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readAccount } from "@/features/account/service";
import { AdminShell } from "@/features/admin/admin-shell";
import {
  listTutorApplications,
  reviewQueueLimit,
} from "@/features/tutors/review";
import { reviewStatusLabels } from "@/features/tutors/review-rules";
import { ReviewStatusBadge } from "@/features/tutors/review-status";
import { EmptyState } from "@/components/shared/empty-state";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Tutor applications",
  robots: { index: false, follow: false },
};
export default async function TutorReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const requested = (await searchParams).status ?? "pending";
  // An unknown value falls back to the working queue instead of an error.
  const status =
    requested === "all"
      ? undefined
      : (reviewStatuses.find((value) => value === requested) ?? "pending");
  const data = await loadPrivatePage(
    "/admin/tutors",
    async (runtime, headers) => ({
      queue: await listTutorApplications(runtime, headers, status),
      account: await readAccount(runtime, headers),
    }),
  );
  if (!data)
    return (
      <UnavailablePage
        title="Workspace access unavailable"
        message="This workspace is not available to your current account. Return to your account to see your assigned access."
      />
    );
  const { total, applications } = data.queue;
  const date = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: data.account.timezone,
  });
  return (
    <AdminShell current="tutors">
      <h1 className="text-page-title">Tutor review queue</h1>
      <p className="mt-4 max-w-prose text-body text-muted-foreground">
        Local test data only. The tutor screening process is not decided.
        Approving an application lists the tutor publicly.
      </p>
      <form method="get" className="mt-8 flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <label htmlFor="status" className="block text-label">
            Status
          </label>
          <select
            className="field"
            id="status"
            name="status"
            defaultValue={status ?? "all"}
          >
            {reviewStatuses.map((value) => (
              <option key={value} value={value}>
                {reviewStatusLabels[value]}
              </option>
            ))}
            <option value="all">All statuses</option>
          </select>
        </div>
        <button className="action action-outline" type="submit">
          Apply filters
        </button>
      </form>
      <div className="mt-8">
        {applications.length === 0 ? (
          <EmptyState
            title={
              status
                ? `No ${reviewStatusLabels[status].toLowerCase()} applications`
                : "No tutor applications"
            }
          >
            <p>An application appears here after a tutor submits a profile.</p>
          </EmptyState>
        ) : (
          <>
            <p role="status" className="text-body">
              {total === 1 ? "1 application" : `${total} applications`}
              {total > applications.length &&
                `. Showing the ${reviewQueueLimit} oldest. Choose a status to narrow the list.`}
            </p>
            <table className="mt-4 w-full border-collapse text-left text-small">
              <caption className="sr-only">Tutor applications</caption>
              <thead>
                <tr className="border-b border-border bg-subtle">
                  <th scope="col" className="px-3 py-3 text-label">
                    Tutor
                  </th>
                  <th scope="col" className="px-3 py-3 text-label">
                    Status
                  </th>
                  <th
                    scope="col"
                    className="hidden px-3 py-3 text-label md:table-cell"
                  >
                    Submitted
                  </th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id} className="border-b border-border">
                    <td className="px-3 py-2 wrap-anywhere">
                      <Link
                        className="inline-flex min-h-11 items-center"
                        href={`/admin/tutors/${application.id}`}
                      >
                        {application.displayName}
                      </Link>
                      <p className="text-muted-foreground">
                        {application.headline}
                      </p>
                      <p className="text-muted-foreground md:hidden">
                        Submitted{" "}
                        <time dateTime={application.createdAt.toISOString()}>
                          {date.format(application.createdAt)}
                        </time>
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <ReviewStatusBadge status={application.reviewStatus} />
                    </td>
                    <td className="hidden px-3 py-3 align-top md:table-cell">
                      <time dateTime={application.createdAt.toISOString()}>
                        {date.format(application.createdAt)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </AdminShell>
  );
}
