import { bookingDetailPath } from "@/features/bookings/read-model";
import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readAuthorReview } from "@/features/private-reviews/service";
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
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const detail = await loadPrivatePage(
    `/bookings/${bookingId}/review`,
    (r, h) => readAuthorReview(r, h, bookingId),
  );
  if (!detail)
    return (
      <UnavailablePage
        title="Private review unavailable"
        message="We cannot find an eligible private review on this account."
      />
    );
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">
        Private synthetic review for {detail.learnerName}
      </h1>
      <PrivateReviewNotice />
      {detail.review ? (
        <ReviewView review={detail.review} />
      ) : (
        <ReviewForm bookingId={bookingId} revision={detail.bookingRevision} />
      )}
      <p className="mt-8 text-body">
        <a
          className="text-primary underline"
          href={bookingDetailPath(bookingId, detail.scope)}
        >
          Return to booking details
        </a>
      </p>
    </div>
  );
}
