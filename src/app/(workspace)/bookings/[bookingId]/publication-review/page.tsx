import { bookingReadScope } from "@/features/bookings/read-input";
import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { publicationContext } from "@/features/review-publication/composition";
import { readAuthorPublication } from "@/features/review-publication/service";
import {
  PublicationNotice,
  PublicationReviewView,
} from "@/features/review-publication/presentation";
import { PublicationForm } from "@/features/review-publication/form";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Synthetic publication review",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { bookingId } = await params;
  const query = await searchParams;
  const scope = bookingReadScope.safeParse(query.scope);
  const returnPath =
    scope.success && scope.data !== "tutor"
      ? `/bookings/${bookingId}?scope=${scope.data}`
      : "/account";
  const value = await loadPrivatePage(
    `/bookings/${bookingId}/publication-review`,
    (r, h) => readAuthorPublication(publicationContext(r), h, bookingId),
  );
  if (!value)
    return (
      <UnavailablePage
        title="Review unavailable"
        message="We cannot find an eligible review on this account. Review publication remains disabled unless an authorized test policy is active."
      />
    );
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Synthetic publication review</h1>
      <PublicationNotice />
      {value.review ? (
        <PublicationReviewView review={value.review} />
      ) : (
        <PublicationForm
          bookingId={bookingId}
          bookingRevision={value.bookingRevision}
          completionEventId={value.completionEventId}
        />
      )}
      <p className="mt-8 text-body">
        <a className="text-primary underline" href={returnPath}>
          {scope.success
            ? "Return to booking details"
            : "Return to your workspace"}
        </a>
      </p>
    </div>
  );
}
