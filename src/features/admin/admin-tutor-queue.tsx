import Link from "next/link";
import { ArrowRight, Ban, CircleCheck, Hourglass } from "lucide-react";
import { reviewStatuses, type ReviewStatus } from "@/lib/db/schema/app";
import { EmptyState } from "@/components/shared/empty-state";
import { reviewStatusLabels } from "@/features/tutors/review-rules";
import { queueScreeningStatus } from "@/features/tutors/readiness-summary";
import {
  reviewQueueLimit,
  type QueueScreeningSummary,
} from "@/features/tutors/review";
import "./admin-tutor-queue.css";
import { nameInitials } from "@/lib/initials";

const statusIcons = {
  pending: Hourglass,
  approved: CircleCheck,
  rejected: Ban,
  suspended: Ban,
} as const;

export type TutorQueueApplication = {
  id: string;
  displayName: string;
  headline: string;
  reviewStatus: ReviewStatus;
  createdAt: Date;
  screening: QueueScreeningSummary | null;
};

/** Presentation only; the page loads the queue through its Admin guard. */
export function AdminTutorQueue({
  intro,
  status,
  applications,
  total,
  page,
  hasMore,
  timezone,
}: {
  intro: string;
  /** The applied filter; undefined means all statuses. */
  status: ReviewStatus | undefined;
  applications: TutorQueueApplication[];
  total: number;
  page: number;
  hasMore: boolean;
  timezone: string;
}) {
  const pageHref = (target: number) =>
    `/admin/tutors?status=${status ?? "all"}&page=${target}`;
  const date = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: timezone,
  });
  const paged = total > reviewQueueLimit;
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">Reviews</p>
          <h1>Tutor review queue</h1>
          <p>{intro}</p>
        </div>
      </header>
      <form method="get" className="tutor-filters">
        <h2>
          Applications{" "}
          <span className="workspace-count" aria-hidden="true">
            {total}
          </span>
        </h2>
        <div className="tutor-filter-fields">
          <label htmlFor="status">Status</label>
          <select
            className="field"
            id="status"
            name="status"
            defaultValue={status ?? "all"}
          >
            {reviewStatuses.map((value) => (
              <option key={value} value={value}>
                {reviewStatusLabels[value]}
              </option>
            ))}
            <option value="all">All statuses</option>
          </select>
          <button className="action action-primary" type="submit">
            Apply filters
          </button>
        </div>
      </form>
      {applications.length === 0 && page === 1 ? (
        <div className="tutor-empty">
          <EmptyState
            title={
              status
                ? `No ${reviewStatusLabels[status].toLowerCase()} applications`
                : "No tutor applications"
            }
          >
            <p>An application appears here after a tutor submits a profile.</p>
          </EmptyState>
        </div>
      ) : (
        <section aria-label="Tutor applications" className="tutor-list">
          <p role="status" className={paged ? "tutor-paging" : "sr-only"}>
            {total === 1 ? "1 application" : `${total} applications`}
            {paged &&
              `. Page ${page}, oldest first, ${reviewQueueLimit} per page.`}
          </p>
          <ul>
            {applications.map((application) => {
              const StatusIcon = statusIcons[application.reviewStatus];
              const [summary, next] = queueScreeningStatus(
                application.screening,
              ).split(" — ");
              const nameId = `tutor-application-${application.id}`;
              return (
                <li key={application.id} className="tutor-card">
                  <div className="tutor-identity">
                    <span className="tutor-avatar" aria-hidden="true">
                      {nameInitials(application.displayName)}
                    </span>
                    <div className="min-w-0">
                      <Link
                        id={nameId}
                        className="tutor-name"
                        href={`/admin/tutors/${application.id}`}
                      >
                        {application.displayName}
                      </Link>
                      <p>{application.headline}</p>
                    </div>
                  </div>
                  <div className="tutor-checks">
                    <div className="tutor-checks-top">
                      <span
                        className="workspace-pill"
                        data-tone={
                          application.reviewStatus === "pending"
                            ? "waiting"
                            : application.reviewStatus === "approved"
                              ? "success"
                              : undefined
                        }
                      >
                        <StatusIcon size={12} aria-hidden="true" />
                        {reviewStatusLabels[application.reviewStatus]}
                      </span>
                      <small>{summary}</small>
                    </div>
                    {application.screening && (
                      <span className="tutor-meter" aria-hidden="true">
                        {Array.from(
                          { length: application.screening.requiredCount },
                          (_, index) => (
                            <i
                              key={index}
                              data-current={
                                index < application.screening!.currentCount ||
                                undefined
                              }
                            />
                          ),
                        )}
                      </span>
                    )}
                    {next && (
                      <p>{next.charAt(0).toUpperCase() + next.slice(1)}.</p>
                    )}
                  </div>
                  <div className="tutor-meta">
                    <p>
                      <time dateTime={application.createdAt.toISOString()}>
                        {date.format(application.createdAt)}
                      </time>{" "}
                      Submitted
                    </p>
                    <Link
                      className="action workspace-action"
                      href={`/admin/tutors/${application.id}`}
                      aria-describedby={nameId}
                    >
                      Review application
                      <span
                        className="workspace-action-icon"
                        aria-hidden="true"
                      >
                        <ArrowRight size={13} />
                      </span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          {(page > 1 || hasMore) && (
            <nav aria-label="Application pages" className="tutor-pages">
              {page > 1 && (
                <Link
                  className="action action-outline"
                  href={pageHref(page - 1)}
                >
                  Previous applications
                </Link>
              )}
              {hasMore && (
                <Link
                  className="action action-outline"
                  href={pageHref(page + 1)}
                >
                  More applications
                </Link>
              )}
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
