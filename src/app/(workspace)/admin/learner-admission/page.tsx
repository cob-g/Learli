import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import type { Metadata } from "next";
import { admissionListCursor } from "@/features/learner-admission/input";
import { LearnerLink } from "@/features/learners/learner-link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { admissionContext } from "@/features/learner-admission/context";
import { listAssignedAdmissions } from "@/features/learner-admission/service";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Assigned admission reviews",
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
        title="Admission unavailable"
        message="Reload the admission list with a valid cursor."
      />
    );
  }
  const result = await loadPrivatePage(
    cursor
      ? `/admin/learner-admission?after=${cursor}`
      : "/admin/learner-admission",
    async (runtime, headers) => ({
      admissions: await listAssignedAdmissions(
        admissionContext(runtime),
        headers,
        cursor,
      ),
      privateWorkflow: hasPersistentWorkflow(runtime),
      localWorkflow: getLocalWorkflow(runtime) !== null,
    }),
  );
  if (!result)
    return (
      <UnavailablePage
        title="Admission unavailable"
        message="We cannot open admission requests on this account."
      />
    );
  const { items: rows, nextCursor } = result.admissions;
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Assigned admission reviews</h1>
      <p className="mt-4 max-w-prose text-body">
        {result.localWorkflow
          ? "Review only your assigned learner requests. Record the checks you performed before authorizing access."
          : result.privateWorkflow
            ? "Review only your assigned learner requests. These fictional records establish no real guardian consent, age or eligibility."
            : "Synthetic readiness only. No real guardian consent, age or eligibility is established."}
      </p>
      {rows.length ? (
        <ul className="mt-8 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="py-4">
              <p className="text-body">
                {row.management === "self"
                  ? "Independent College Support"
                  : "Guardian-managed request"}
                . {row.state}.
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
                href={`/admin/learner-admission/${row.id}`}
                className="mt-2 inline-flex min-h-11 items-center"
                label="Open request"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-body">No admission requests are available.</p>
      )}
      <nav aria-label="Admission list pages" className="mt-8 flex gap-6">
        {cursor && (
          <LearnerLink
            href="/admin/learner-admission"
            label="First page"
            className="inline-flex min-h-11 items-center"
          />
        )}
        {nextCursor && (
          <LearnerLink
            href={`/admin/learner-admission?after=${nextCursor}`}
            label="Next page"
            className="inline-flex min-h-11 items-center"
          />
        )}
      </nav>
      <LearnerLink
        href="/account"
        className="ms-4 mt-8 inline-flex min-h-11 items-center"
        label="Your account"
      />
    </div>
  );
}
