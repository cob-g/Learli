import Link from "next/link";
import { CircleCheck, Info } from "lucide-react";
import type { ReviewStatus } from "@/lib/db/schema/app";
import { cn } from "@/lib/utils";
import "./review-notice.css";

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
      body: "Your profile is listed on Learli. Local simulated reservations do not confirm lessons.",
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

/** The notice wording for a stored review state; shared by every presentation. */
export function reviewNoticeText(
  status: ReviewStatus | null,
  privateWorkflow = false,
) {
  const { title, body } = notices[status ?? "none"];
  return {
    title,
    body:
      status === "approved" && privateWorkflow
        ? "Your profile is approved. Current screening is also required for discovery and bookings."
        : body,
  };
}

/** Where the signed-in tutor's own profile stands, worded from the stored state. */
export function ReviewNotice({
  status,
  editHref,
  publicHref,
  privateWorkflow = false,
  banner = false,
}: {
  status: ReviewStatus | null;
  editHref?: string;
  /** The tutor's public page, once approved. */
  publicHref?: string;
  privateWorkflow?: boolean;
  /** One-row Tutor workspace banner; the wording and links are unchanged. */
  banner?: boolean;
}) {
  const { title, body } = reviewNoticeText(status, privateWorkflow);
  const approved = status === "approved";
  const Icon = approved ? CircleCheck : Info;
  const links = [
    ...(editHref ? [{ href: editHref, label: "Edit profile" }] : []),
    ...(approved && publicHref
      ? [{ href: publicHref, label: "View public profile" }]
      : []),
    { href: "/contact", label: "Contact support" },
  ];
  if (banner)
    return (
      <section
        aria-labelledby="review-notice-title"
        className="review-banner"
        data-approved={approved || undefined}
      >
        <span className="review-banner-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <h2 id="review-notice-title">{title}</h2>
          <p>{body}</p>
        </div>
        <p className="review-banner-links">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </p>
      </section>
    );
  return (
    <section
      aria-labelledby="review-notice-title"
      className={cn(
        "flex max-w-3xl gap-3 rounded-surface border p-6",
        approved ? "border-success bg-success-soft" : "border-border bg-subtle",
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
        <p className="mt-2 max-w-prose text-small">{body}</p>
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
