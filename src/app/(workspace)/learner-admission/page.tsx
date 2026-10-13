import type { Metadata } from "next";
import { admissionListCursor } from "@/features/learner-admission/input";
import { LearnerLink } from "@/features/learners/learner-link";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { admissionContext } from "@/features/learner-admission/context";
import { listMyAdmissions } from "@/features/learner-admission/service";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your admission requests",
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
    cursor ? `/learner-admission?after=${cursor}` : "/learner-admission",
    (runtime, headers) =>
      listMyAdmissions(admissionContext(runtime), headers, cursor),
  );
  if (!result)
    return (
      <UnavailablePage
        title="Admission unavailable"
        message="We cannot open admission requests on this account."
      />
    );
  const { items: rows, nextCursor } = result;
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Your admission requests</h1>
      <p className="mt-4 max-w-prose text-body">
        Synthetic readiness only. No real guardian consent, age or eligibility
        is established.
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
                href={`/learner-admission/${row.id}`}
                className="mt-2 inline-flex min-h-11 items-center"
                label="Open request"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-body">No admission requests are available.</p>
      )}
      <LearnerLink
        href="/learner-admission/new"
        className="action action-primary mt-8"
        label="Request admission review"
      />
      <nav aria-label="Admission list pages" className="mt-8 flex gap-6">
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
        className="ms-4 mt-8 inline-flex min-h-11 items-center"
        label="Your account"
      />
    </div>
  );
}
