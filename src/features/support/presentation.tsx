import Link from "next/link";
import { Check, Hourglass, Info } from "lucide-react";
import { categoryLabels, statusLabels, type CaseStatus } from "./input";
import type { CaseDetail, CaseList } from "./service";
import { CaseTitle } from "./title";
import { StatusForm } from "./status-form";

export function DemoNotice() {
  return (
    <p className="mt-4 max-w-prose text-body text-muted-foreground">
      Local demo for fictional reports only. This is not monitored and is not an
      emergency reporting channel. Do not enter real personal details, dates of
      birth, school names or private meeting links.
    </p>
  );
}
export function CaseStatusLabel({ status }: { status: CaseStatus }) {
  const Icon =
    status === "closed" ? Check : status === "in_review" ? Info : Hourglass;
  return (
    <span className="inline-flex items-center gap-1 rounded-tag border border-control bg-subtle px-2 py-1 text-label">
      <Icon className="size-4" aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}
export function CaseRows({
  result,
  reviewer = false,
}: {
  result: CaseList;
  reviewer?: boolean;
}) {
  const base = reviewer ? "/admin/support" : "/support";
  return (
    <>
      {result.cases.length ? (
        <ul className="mt-8 max-w-5xl divide-y divide-border">
          {result.cases.map((row) => (
            <li
              key={row.id}
              className="flex min-w-0 flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <h2 className="text-item-title wrap-anywhere">
                  <Link href={`${base}/${row.id}`}>{row.subject}</Link>
                </h2>
                <p className="mt-2 text-small text-muted-foreground">
                  {categoryLabels[row.category]}
                </p>
              </div>
              <CaseStatusLabel status={row.status} />
            </li>
          ))}
        </ul>
      ) : (
        <section className="mt-8 max-w-prose">
          <h2 className="text-item-title">
            {reviewer
              ? "No cases assigned to you"
              : "No reports on this account"}
          </h2>
          <p className="mt-2 text-body">
            {reviewer
              ? "Only cases assigned through trusted local tooling appear here."
              : "Your fictional reports will appear here after you save them."}
          </p>
        </section>
      )}
      <nav aria-label="Case pages" className="mt-8 flex flex-wrap gap-4">
        {result.page > 1 && (
          <Link
            className="action action-outline"
            href={`${base}?page=${result.page - 1}`}
          >
            Previous cases
          </Link>
        )}
        {result.hasMore && (
          <Link
            className="action action-outline"
            href={`${base}?page=${result.page + 1}`}
          >
            More cases
          </Link>
        )}
      </nav>
    </>
  );
}
function auditTime(date: Date) {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    })
      .format(date)
      .replaceAll("\u202f", " ") + " UTC"
  );
}
export function CaseView({
  detail,
  reviewer = false,
}: {
  detail: CaseDetail;
  reviewer?: boolean;
}) {
  return (
    <>
      <CaseTitle subject={detail.subject} />
      <DemoNotice />
      <div className="mt-8">
        <CaseStatusLabel status={detail.status} />
        <p className="mt-4 text-body">{categoryLabels[detail.category]}</p>
        <p className="mt-4 max-w-prose text-prose wrap-anywhere whitespace-pre-wrap">
          {detail.body}
        </p>
      </div>
      {reviewer && (
        <StatusForm
          caseId={detail.id}
          status={detail.status}
          revision={detail.revision}
        />
      )}
      <section className="mt-12 max-w-prose">
        <h2 className="text-section-title">Case history</h2>
        <ol className="mt-4 divide-y divide-border">
          {detail.history.map((event) => (
            <li className="py-4" key={event.revision}>
              <p className="text-body">
                {event.action === "created"
                  ? "Fictional report saved"
                  : event.action === "assigned"
                    ? "Reviewer assigned by local tooling"
                    : event.action === "reassigned"
                      ? "Reviewer reassigned by local tooling"
                      : `Status changed from ${statusLabels[event.previousStatus!]} to ${statusLabels[event.nextStatus!]}`}
              </p>
              <time
                className="mt-2 block text-caption text-muted-foreground"
                dateTime={event.createdAt.toISOString()}
              >
                {auditTime(event.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      </section>
      <Link
        className="mt-8 inline-flex min-h-11 items-center"
        href={reviewer ? "/admin/support" : "/support"}
      >
        {reviewer ? "Assigned cases" : "Your reports"}
      </Link>
    </>
  );
}
