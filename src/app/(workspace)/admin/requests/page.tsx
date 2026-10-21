import type { Metadata } from "next";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listLocalReviews } from "@/features/local-workflow/review-service";
import { AdminReviewQueue } from "@/features/admin/admin-review-queue";

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
  return <AdminReviewQueue data={data} />;
}
