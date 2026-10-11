import Link from "next/link";
import { CircleCheck, Info } from "lucide-react";
import type { ReviewStatus } from "@/lib/db/schema/app";
import { cn } from "@/lib/utils";

const notices: Record<ReviewStatus | "none", { title: string; body: string }> =
  {
    none: {
      title: "Your profile is not public yet",
      body: "Your profile cannot be booked until it is public.",
    },
    pending: {
      title: "Learli is reviewing your application",
      body: "Your profile cannot be booked until it is public.",
    },
    approved: {
      title: "Your application is approved",
      body: "Your profile is listed on Learli. Booking is not available yet.",
    },
    rejected: {
      title: "Your application was not approved",
      body: "You can edit your profile and submit it again.",
    },
    suspended: {
      title: "Your tutor profile is suspended",
      body: "You can't edit this profile or take bookings. Contact support if you have questions.",
    },
  };

/** Where the signed-in tutor's own profile stands, worded from the stored state. */
export function ReviewNotice({
  status,
  editHref,
  publicHref,
}: {
  status: ReviewStatus | null;
  editHref?: string;
  /** The tutor's public page, once approved. */
  publicHref?: string;
}) {
  const { title, body } = notices[status ?? "none"];
  const approved = status === "approved";
  const Icon = approved ? CircleCheck : Info;
  return (
    <section
      aria-labelledby="review-notice-title"
      className={cn(
        "flex max-w-prose gap-3 rounded-surface border p-4",
        approved
          ? "border-success bg-success-soft"
          : "border-foreground bg-subtle",
      )}
    >
      <Icon
        size={20}
        aria-hidden="true"
        className={cn(
          "mt-0.5 shrink-0",
          approved ? "text-success" : "text-primary",
        )}
      />
      <div className="min-w-0">
        <h2 id="review-notice-title" className="text-item-title">
          {title}
        </h2>
        <p className="mt-2 text-body">{body}</p>
        <p className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-body">
          {editHref && (
            <Link className="inline-flex min-h-11 items-center" href={editHref}>
              Edit profile
            </Link>
          )}
          {approved && publicHref && (
            <Link
              className="inline-flex min-h-11 items-center"
              href={publicHref}
            >
              View public profile
            </Link>
          )}
          <Link className="inline-flex min-h-11 items-center" href="/contact">
            Contact support
          </Link>
        </p>
      </div>
    </section>
  );
}
