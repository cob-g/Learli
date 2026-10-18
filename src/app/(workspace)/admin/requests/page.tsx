import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/features/admin/admin-shell";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listLocalReviews } from "@/features/local-workflow/review-service";
import {
  ClaimLocalReview,
  ClaimLocalAccount,
} from "@/features/local-workflow/review-forms";
import { localReviewLabels } from "@/features/local-workflow/review-input";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Unassigned reviews",
  robots: { index: false, follow: false },
};
export default async function LocalReviewQueue() {
  const data = await loadPrivatePage("/admin/requests", listLocalReviews);
  if (!data)
    return (
      <UnavailablePage
        title="Review queue unavailable"
        message="Sign in with an authorized Admin account and complete Admin verification to open this queue."
      />
    );
  return (
    <AdminShell>
      <h1 className="text-page-title">Unassigned reviews</h1>
      <p className="mt-4 max-w-prose text-body">
        Claim a request to review its details. Claiming assigns the work to you;
        it does not approve a learner, tutor or booking.
      </p>
      {data.items.length ? (
        <ul className="mt-8 divide-y divide-border">
          {data.items.map((item) => (
            <li key={`${item.kind}:${item.targetId}`} className="py-6">
              <h2 className="text-item-title">
                {localReviewLabels[item.kind]}
              </h2>
              <p className="mt-2 text-small text-muted-foreground">
                Submitted{" "}
                <time dateTime={item.submittedAt.toISOString()}>
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "UTC",
                  }).format(item.submittedAt)}{" "}
                  UTC
                </time>
              </p>
              <ClaimLocalReview kind={item.kind} targetId={item.targetId} />
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="mt-8 max-w-prose text-body">
          No unassigned requests are available to your current review
          permissions. Assigned work remains in its own section.
        </p>
      )}
      {data.hasMore && (
        <p className="mt-4 text-small">
          Showing the oldest 50 requests. Claim work and refresh to load more.
        </p>
      )}
      {data.accountAllowed && (
        <section className="mt-10 max-w-prose border-t border-border pt-8">
          <h2 className="text-section-title">Claim account support</h2>
          <p className="mt-3 text-body">
            Enter the exact account ID from a support request. This creates
            access to that account only. Admin accounts and your own account
            cannot be claimed.
          </p>
          <ClaimLocalAccount />
        </section>
      )}
      <Link className="action action-outline mt-8" href="/admin/requests">
        Refresh requests
      </Link>
    </AdminShell>
  );
}
