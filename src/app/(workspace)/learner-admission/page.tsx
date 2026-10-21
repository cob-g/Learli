import type { Metadata } from "next";
import { admissionListCursor } from "@/features/learner-admission/input";
import { LearnerLink } from "@/features/learners/learner-link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { admissionContext } from "@/features/learner-admission/context";
import { listMyAdmissions } from "@/features/learner-admission/service";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your learner review records",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ after?: string | string[] }>;
}) {
  const rawCursor = (await searchParams).after;
  let cursor: string | null = null;
  try {
    cursor = admissionListCursor(rawCursor);
  } catch {
    return (
      <UnavailablePage
        title="Learner reviews unavailable"
        message="Reload the learner review list with a valid cursor."
      />
    );
  }
  const result = await loadPrivatePage(
    cursor ? `/learner-admission?after=${cursor}` : "/learner-admission",
    async (runtime, headers) => ({
      ...(await listMyAdmissions(admissionContext(runtime), headers, cursor)),
      privateWorkflow: hasPersistentWorkflow(runtime),
      localWorkflow: getLocalWorkflow(runtime) !== null,
    }),
  );
  if (!result)
    return (
      <UnavailablePage
        title="Learner reviews unavailable"
        message="We cannot open learner review records on this account."
      />
    );
  const { items: rows, nextCursor, privateWorkflow, localWorkflow } = result;
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">
        {localWorkflow
          ? "Earlier learner review records"
          : "Your admission requests"}
      </h1>
      <p className="mt-4 max-w-prose text-body">
        {localWorkflow
          ? "These retained records cover earlier or exceptional learner reviews. New child profiles and eligible independent College Support learners use self-service setup."
          : privateWorkflow
            ? "Check each request’s current review status. Pending requests grant no learner or booking access."
            : "Synthetic readiness only. No real guardian consent, age or eligibility is established."}
      </p>
      <div className="mt-6 max-w-5xl rounded-surface border border-border bg-surface p-6 sm:p-8">
        {rows.length ? (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="min-w-0 py-4 first:pt-0 last:pb-0">
                <p className="text-body">
                  {row.management === "self"
                    ? localWorkflow
                      ? "Independent College Support record"
                      : "Independent College Support"
                    : localWorkflow
                      ? "Guardian-managed record"
                      : "Guardian-managed request"}
                  .{" "}
                  {privateWorkflow
                    ? row.state.charAt(0).toUpperCase() + row.state.slice(1)
                    : row.state}
                  .
                </p>
                <p className="mt-2 text-caption">
                  Policy: {row.policyVersion}. Requested{" "}
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "UTC",
                  }).format(row.createdAt)}{" "}
                  UTC.
                </p>
                <LearnerLink
                  href={`/learner-admission/${row.id}`}
                  className="mt-2 inline-flex min-h-11 items-center"
                  label={localWorkflow ? "Open record" : "Open request"}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body">
            {localWorkflow
              ? "No earlier learner review records are available."
              : "No admission requests are available."}
          </p>
        )}
      </div>
      {!result.localWorkflow && (
        <LearnerLink
          href="/learner-admission/new"
          className="action action-primary mt-6 w-full sm:w-auto"
          label="Request admission review"
        />
      )}
      <nav
        aria-label={
          localWorkflow ? "Learner review record pages" : "Admission list pages"
        }
        className="mt-8 flex gap-6"
      >
        {cursor && (
          <LearnerLink
            href="/learner-admission"
            label="First page"
            className="inline-flex min-h-11 items-center"
          />
        )}
        {nextCursor && (
          <LearnerLink
            href={`/learner-admission?after=${nextCursor}`}
            label="Next page"
            className="inline-flex min-h-11 items-center"
          />
        )}
      </nav>
      <LearnerLink
        href="/account"
        className="me-6 mt-8 inline-flex min-h-11 items-center"
        label="Your account"
      />
    </div>
  );
}
