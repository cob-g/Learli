import { AdminShell } from "@/features/admin/admin-shell";
import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listModeratorReviews } from "@/features/private-reviews/service";
import { PrivateReviewNotice } from "@/features/private-reviews/presentation";
import { stateLabels } from "@/features/private-reviews/input";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private local review scope",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const detail = await loadPrivatePage("/admin/reviews", (r, h) =>
    listModeratorReviews(r, h),
  );
  if (!detail)
    return (
      <UnavailablePage
        title="Private review scope unavailable"
        message="This account cannot read local review scope."
      />
    );
  return (
    <AdminShell current="reviews">
      <h1 className="text-page-title">Private local review scope</h1>
      <PrivateReviewNotice />
      {detail.reviews.length ? (
        <ul className="mt-8 max-w-5xl divide-y divide-border">
          {detail.reviews.map((r, i) => (
            <li key={r.id} className="py-4 text-body">
              <a
                className="text-primary underline"
                href={`/admin/reviews/${r.id}`}
              >
                Open scoped review {i + 1}
              </a>
              <p className="mt-2 text-small">{stateLabels[r.state]}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-body">
          No reviews are granted to this account. Local owner tooling must
          provision each exact review.
        </p>
      )}
      {detail.hasMore && (
        <p className="mt-4 text-body">
          Showing the latest 20 granted reviews. Open another review using its
          owner-provided private URL.
        </p>
      )}
    </AdminShell>
  );
}
