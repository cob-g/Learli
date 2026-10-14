import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { listDispatchCases } from "@/features/support/dispatch-service";
import { DemoNotice, CaseStatusLabel } from "@/features/support/presentation";
import { categoryLabels } from "@/features/support/input";
import { AdminShell } from "@/features/admin/admin-shell";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { safePage } from "@/features/support/input";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Local support assignments",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = safePage((await searchParams).page);
  const result = await loadPrivatePage(
    "/admin/support/dispatch",
    (runtime, headers) => listDispatchCases(runtime, headers, page),
  );
  if (!result)
    return (
      <UnavailablePage
        title="Assignments unavailable"
        message="We cannot open local assignments on this account."
      />
    );
  return (
    <AdminShell current="support">
      <h1 className="text-page-title">Local support assignments</h1>
      <DemoNotice />
      <p className="mt-4 max-w-prose text-body">
        Only cases explicitly provisioned to you for local dispatch appear here.
        Assignment authority does not grant access to report descriptions or
        booking details.
      </p>
      {result.cases.length ? (
        <ul className="mt-8 max-w-5xl divide-y divide-border">
          {result.cases.map((row) => (
            <li
              key={row.id}
              className="flex min-w-0 flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <h2 className="text-item-title">
                  {categoryLabels[row.category]}
                </h2>
                <p className="mt-2 text-small wrap-anywhere text-muted-foreground">
                  Case reference: {row.id}
                </p>
                <p className="mt-2 text-body">
                  {row.assigned
                    ? (row.reviewer ??
                      "Assigned reviewer currently unavailable")
                    : "No reviewer assigned"}
                </p>
                <a
                  className="mt-2 inline-flex min-h-11 items-center"
                  href={`/admin/support/dispatch/${row.id}`}
                >
                  Manage local assignment
                </a>
              </div>
              <CaseStatusLabel status={row.status} />
            </li>
          ))}
        </ul>
      ) : (
        <section className="mt-8 max-w-prose">
          <h2 className="text-item-title">No cases provisioned for dispatch</h2>
          <p className="mt-2 text-body">
            The local fixture owner must grant access to an exact case before it
            appears here.
          </p>
        </section>
      )}
      <nav aria-label="Assignment pages" className="mt-8 flex flex-wrap gap-4">
        {result.page > 1 && (
          <a
            className="action action-outline"
            href={`?page=${result.page - 1}`}
          >
            Previous assignments
          </a>
        )}
        {result.hasMore && (
          <a
            className="action action-outline"
            href={`?page=${result.page + 1}`}
          >
            More assignments
          </a>
        )}
      </nav>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Native cross-permission navigation replaces the private document. */}
      <a
        className="mt-8 inline-flex min-h-11 items-center"
        href="/admin/support"
      >
        Assigned review cases
      </a>
    </AdminShell>
  );
}
