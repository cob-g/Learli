import type { Metadata } from "next";
import { AdminShell } from "@/features/admin/admin-shell";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { publicationContext } from "@/features/review-publication/composition";
import { listModeratorPublications } from "@/features/review-publication/service";
import { PublicationNotice } from "@/features/review-publication/presentation";
import { publicationStateLabels } from "@/features/review-publication/input";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Assigned publication reviews",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const value = await loadPrivatePage("/admin/publication-reviews", (r, h) =>
    listModeratorPublications(publicationContext(r), h),
  );
  if (!value)
    return (
      <UnavailablePage
        title="Review scope unavailable"
        message="This account cannot read publication review scope."
      />
    );
  return (
    <AdminShell current="publication-reviews">
      <h1 className="text-page-title">Assigned publication reviews</h1>
      <PublicationNotice />
      {value.reviews.length ? (
        <ul className="mt-8 divide-y divide-border">
          {value.reviews.map((v, i) => (
            <li key={v.id} className="py-4">
              <a
                className="text-body text-primary underline"
                href={`/admin/publication-reviews/${v.id}`}
              >
                Open assigned review {i + 1}
              </a>
              <p className="mt-2 text-body">
                {publicationStateLabels[v.state]}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-body">
          No publication reviews are assigned to this account.
        </p>
      )}
      {value.hasMore && (
        <p className="mt-4 text-body">
          Showing the latest 20 assigned reviews. Open another review using its
          owner-provided private URL.
        </p>
      )}
    </AdminShell>
  );
}
