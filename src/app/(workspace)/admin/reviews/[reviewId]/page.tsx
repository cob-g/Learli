import { AdminShell } from "@/features/admin/admin-shell";
import Link from "next/link";
import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readModeratorReview } from "@/features/private-reviews/service";
import {
  PrivateReviewNotice,
  ReviewView,
} from "@/features/private-reviews/presentation";
import { ReviewForm } from "@/features/private-reviews/form";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private synthetic review",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  const detail = await loadPrivatePage(`/admin/reviews/${reviewId}`, (r, h) =>
    readModeratorReview(r, h, reviewId),
  );
  if (!detail)
    return (
      <UnavailablePage
        title="Private review unavailable"
        message="We cannot find an eligible private review on this account."
      />
    );
  return (
    <AdminShell current="reviews">
      <h1 className="text-page-title">Moderate a private synthetic review</h1>
      <PrivateReviewNotice />
      <ReviewView review={detail} />
      <ReviewForm
        key={detail.revision}
        reviewId={reviewId}
        revision={detail.revision}
        state={detail.state}
      />
      <p className="mt-8 text-body">
        <Link
          className="text-primary underline"
          href="/admin/reviews"
          prefetch={false}
        >
          Return to exact local review scope
        </Link>
      </p>
    </AdminShell>
  );
}
