import Link from "next/link";
import {
  CalendarDays,
  Check,
  Clock,
  FileText,
  LockKeyhole,
  MessageSquare,
  RefreshCw,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  ClaimLocalReview,
  ClaimLocalAccount,
} from "@/features/local-workflow/review-forms";
import {
  localReviewLabels,
  type LocalReviewKind,
} from "@/features/local-workflow/review-input";
import "./admin-review-queue.css";

const kindIcons: Record<LocalReviewKind, LucideIcon> = {
  admission: FileText,
  screening: UserCheck,
  booking: CalendarDays,
  support: MessageSquare,
  account: Users,
};
type QueueItem = {
  kind: LocalReviewKind;
  targetId: string;
  submittedAt: Date;
};

/** Presentation only; the page loads the queue through its Admin guard. */
export function AdminReviewQueue({
  data,
}: {
  data: { items: QueueItem[]; hasMore: boolean; accountAllowed: boolean };
}) {
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">Reviews</p>
          <h1>Unassigned reviews</h1>
          <p>
            Claim a request to review its details.{" "}
            <strong>
              Claiming assigns the work to you; it does not approve a learner,
              tutor or booking.
            </strong>
          </p>
        </div>
        <div className="review-legend" aria-hidden="true">
          <p>
            <i data-tone="waiting" />
            Unassigned, waiting for an admin
          </p>
          <p>
            <i data-tone="claimed" />
            Claiming opens the review for you
          </p>
        </div>
      </header>
      <div
        className="review-columns"
        data-single={data.accountAllowed ? undefined : true}
      >
        <section className="review-panel" aria-labelledby="review-queue-title">
          <div className="review-panel-header">
            <h2 id="review-queue-title">
              Review queue{" "}
              <span className="workspace-count" aria-hidden="true">
                {data.items.length}
                {data.hasMore && "+"}
              </span>
            </h2>
            <Link className="review-refresh" href="/admin/requests">
              <RefreshCw size={15} aria-hidden="true" />
              Refresh requests
            </Link>
          </div>
          {data.items.length ? (
            <ul>
              {data.items.map((item) => {
                const Icon = kindIcons[item.kind];
                return (
                  <li key={`${item.kind}:${item.targetId}`}>
                    <span className="review-item-icon" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <div className="min-w-0">
                      <h3>
                        {localReviewLabels[item.kind]}{" "}
                        <span
                          className="workspace-pill"
                          data-tone="waiting"
                          data-dot
                          aria-hidden="true"
                        >
                          Unassigned
                        </span>
                      </h3>
                      <p>
                        Submitted{" "}
                        <time dateTime={item.submittedAt.toISOString()}>
                          {new Intl.DateTimeFormat("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "UTC",
                          }).format(item.submittedAt)}{" "}
                          UTC
                        </time>
                      </p>
                    </div>
                    <div className="review-item-action">
                      <ClaimLocalReview
                        kind={item.kind}
                        targetId={item.targetId}
                        queue
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p role="status" className="review-empty">
              No unassigned requests are available to your current review
              permissions. Assigned work remains in its own section.
            </p>
          )}
          <div className="review-panel-footer">
            <Clock size={14} aria-hidden="true" />
            <p>
              {data.hasMore
                ? "Showing the oldest 50 requests. Claim work and refresh to load more."
                : "Oldest requests appear first."}
            </p>
          </div>
        </section>
        {data.accountAllowed && (
          <section
            className="review-panel review-support"
            aria-labelledby="account-support-title"
          >
            <div className="review-panel-header">
              <div className="review-support-heading">
                <span className="review-item-icon" aria-hidden="true">
                  <LockKeyhole size={20} />
                </span>
                <h2 id="account-support-title">Claim account support</h2>
              </div>
            </div>
            <div className="review-support-body">
              <p>
                Enter the exact account ID from a support request.{" "}
                <strong>This creates access to that account only.</strong> Admin
                accounts and your own account cannot be claimed.
              </p>
              <ClaimLocalAccount queue />
              <ul className="review-rules" aria-label="Account claim limits">
                <li data-ok>
                  <Check size={14} aria-hidden="true" />
                  Access to that exact account only
                </li>
                <li>
                  <X size={14} aria-hidden="true" />
                  Admin accounts cannot be claimed
                </li>
                <li>
                  <X size={14} aria-hidden="true" />
                  Your own account cannot be claimed
                </li>
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
