import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { readDispatchCase } from "@/features/support/dispatch-service";
import { AssignmentForm } from "@/features/support/assignment-form";
import { DemoNotice, CaseStatusLabel } from "@/features/support/presentation";
import { categoryLabels } from "@/features/support/input";
import { AdminShell } from "@/features/admin/admin-shell";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { safePage } from "@/features/support/input";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Local case assignment",
  robots: { index: false, follow: false },
};
const labels = {
  assign: "Reviewer assigned",
  reassign: "Reviewer reassigned",
  escalate: "Local escalation reassigned reviewer",
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { caseId } = await params,
    page = safePage((await searchParams).page);
  const detail = await loadPrivatePage(
    `/admin/support/dispatch/${caseId}`,
    (runtime, headers) => readDispatchCase(runtime, headers, caseId, page),
  );
  if (!detail)
    return (
      <UnavailablePage
        title="Assignment unavailable"
        message="We cannot find that case assignment on this account."
      />
    );
  return (
    <AdminShell current="support">
      <h1 className="text-page-title">Local case assignment</h1>
      <DemoNotice />
      <dl className="mt-8 max-w-xl space-y-4">
        <div>
          <dt className="text-label">Case reference</dt>
          <dd className="mt-2 text-body wrap-anywhere">{detail.id}</dd>
        </div>
        <div>
          <dt className="text-label">Category</dt>
          <dd className="mt-2 text-body">{categoryLabels[detail.category]}</dd>
        </div>
        <div>
          <dt className="text-label">Status</dt>
          <dd className="mt-2">
            <CaseStatusLabel status={detail.status} />
          </dd>
        </div>
        <div>
          <dt className="text-label">Current reviewer fixture</dt>
          <dd className="mt-2 text-body wrap-anywhere">
            {detail.assigned
              ? (detail.reviewer ?? "Assigned reviewer currently unavailable")
              : "No reviewer assigned"}
          </dd>
        </div>
      </dl>
      <AssignmentForm detail={detail} />
      <section className="mt-12 max-w-prose">
        <h2 className="text-section-title">Local assignment history</h2>
        {detail.history.length ? (
          <ol className="mt-4 divide-y divide-border">
            {detail.history.map((event) => (
              <li key={event.revision} className="py-4">
                <p className="text-body">
                  {labels[event.kind]} · {event.actor}
                </p>
                <time
                  className="mt-2 block text-caption text-muted-foreground"
                  dateTime={event.createdAt}
                >
                  {new Intl.DateTimeFormat("en-US", {
                    timeZone: "UTC",
                    dateStyle: "long",
                    timeStyle: "long",
                  }).format(new Date(event.createdAt))}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-body">
            No dispatcher assignment actions recorded.
          </p>
        )}
        <nav
          aria-label="Assignment history pages"
          className="mt-4 flex flex-wrap gap-4"
        >
          {detail.page > 1 && (
            <a href={`?page=${detail.page - 1}`}>Previous history</a>
          )}
          {detail.hasMore && (
            <a href={`?page=${detail.page + 1}`}>More history</a>
          )}
        </nav>
      </section>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Native cross-permission navigation replaces the private document. */}
      <a
        className="mt-8 inline-flex min-h-11 items-center"
        href="/admin/support/dispatch"
      >
        Local assignments
      </a>
    </AdminShell>
  );
}
