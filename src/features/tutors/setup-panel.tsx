import Link from "next/link";
import { ArrowRight, Check, CircleCheck, Info } from "lucide-react";
import type { ReviewStatus } from "@/lib/db/schema/app";
import type { TutorReadiness } from "./readiness-summary";
import { reviewNoticeText } from "./review-notice";

/**
 * The Tutor bookings overview: readiness steps, the stored review notice and
 * the one next setup action, in a single panel. Presentation only.
 */
export function TutorSetupPanel({
  readiness,
  reviewStatus,
  publicHref,
  privateWorkflow = false,
}: {
  readiness: TutorReadiness;
  reviewStatus: ReviewStatus | null;
  /** The tutor's public page, once it is listed. */
  publicHref?: string;
  privateWorkflow?: boolean;
}) {
  const done = readiness.items.filter((item) => item.complete).length;
  const { title, body } = reviewNoticeText(reviewStatus, privateWorkflow);
  const approved = reviewStatus === "approved";
  const links = [
    { href: "/tutor/profile", label: "Edit profile" },
    ...(approved && publicHref
      ? [{ href: publicHref, label: "View public profile" }]
      : []),
    { href: "/contact", label: "Contact support" },
  ];
  // The readiness action always shows, as before; only an identical link is not repeated.
  const action = links.some(
    (link) =>
      link.href === readiness.nextAction.href &&
      link.label === readiness.nextAction.label,
  )
    ? null
    : readiness.nextAction;
  const NoticeIcon = approved ? CircleCheck : Info;
  return (
    <section
      className="tutor-setup"
      data-surface="inverse"
      aria-labelledby="tutor-setup-title"
    >
      <p className="workspace-eyebrow" aria-hidden="true">
        Tutor setup
      </p>
      <h2 id="tutor-setup-title">
        <span className="sr-only">Tutor setup: </span>
        {done} of {readiness.items.length} steps complete
      </h2>
      <p className="tutor-setup-lede">
        These steps show your current coordination status. Availability is
        managed separately from public-listing eligibility.
      </p>
      <ol className="tutor-steps">
        {readiness.items.map((item, index) => (
          <li key={item.key} data-complete={item.complete || undefined}>
            <span className="tutor-step-number">
              <span className="tutor-step-mark" aria-hidden="true">
                {item.complete && <Check size={12} />}
              </span>
              Step {index + 1}
            </span>
            <b>
              {item.label}
              <span className="sr-only">
                {item.complete ? " (complete)" : " (not complete)"}
              </span>
            </b>
            <p>{item.detail}</p>
          </li>
        ))}
      </ol>
      <div className="tutor-review" data-approved={approved || undefined}>
        <span className="tutor-review-icon" aria-hidden="true">
          <NoticeIcon size={20} />
        </span>
        <div className="min-w-0">
          <h3>{title}</h3>
          <p>{body}</p>
        </div>
        <nav aria-label="Tutor setup actions">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
          {action && (
            <Link className="action workspace-action" href={action.href}>
              {action.label}
              <span className="workspace-action-icon" aria-hidden="true">
                <ArrowRight size={13} />
              </span>
            </Link>
          )}
        </nav>
      </div>
    </section>
  );
}
