import Link from "next/link";
import type { Metadata } from "next";
import { AdminShell } from "@/features/admin/admin-shell";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { publicationContext } from "@/features/review-publication/composition";
import { readModeratorPublication } from "@/features/review-publication/service";
import {
  PublicationNotice,
  PublicationReviewView,
} from "@/features/review-publication/presentation";
import { PublicationForm } from "@/features/review-publication/form";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Synthetic review moderation",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  const value = await loadPrivatePage(
    `/admin/publication-reviews/${reviewId}`,
    (r, h) => readModeratorPublication(publicationContext(r), h, reviewId),
  );
  if (!value)
    return (
      <UnavailablePage
        title="Review unavailable"
        message="We cannot find an assigned review on this account."
      />
    );
  return (
    <AdminShell current="publication-reviews">
      <h1 className="text-page-title">
        Moderate a synthetic publication review
      </h1>
      <PublicationNotice />
      <PublicationReviewView review={value} />
      <PublicationForm
        key={value.revision}
        reviewId={reviewId}
        revision={value.revision}
        state={value.state}
      />
      <p className="mt-8 text-body">
        <Link
          prefetch={false}
          className="text-primary underline"
          href="/admin/publication-reviews"
        >
          Return to assigned publication reviews
        </Link>
      </p>
    </AdminShell>
  );
}
