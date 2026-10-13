import { selectionFromReturnPath } from "@/features/bookings/selection";
import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { admissionContext } from "@/features/learner-admission/context";
import { readMyAdmission } from "@/features/learner-admission/service";

import { LearnerLink } from "@/features/learners/learner-link";
import { levelNames } from "@/features/subjects/catalog";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admission request",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ admissionId: string }>;
}) {
  const { admissionId } = await params;
  const row = await loadPrivatePage(
    `/learner-admission/${admissionId}`,
    (runtime, headers) =>
      readMyAdmission(admissionContext(runtime), headers, admissionId),
  );
  if (!row)
    return (
      <UnavailablePage
        title="Admission unavailable"
        message="We cannot open this admission request on this account."
      />
    );
  return (
    <div className="page-shell page-space">
      <LearnerLink
        href="/learner-admission"
        className="inline-flex min-h-11 items-center"
        label="Admission requests"
      />
      <h1 className="mt-4 text-page-title">Admission request</h1>
      <p className="mt-4 max-w-prose text-body">
        Synthetic readiness only. This record establishes no real consent or
        eligibility.
      </p>
      <section
        className="mt-6 max-w-prose rounded-surface border border-border bg-surface p-6 sm:p-8"
        aria-labelledby="admission-learner-heading"
      >
        <h2
          id="admission-learner-heading"
          className="text-section-title wrap-anywhere"
        >
          {row.learner.displayName}
        </h2>
        <p className="mt-2 text-body">
          {levelNames([row.learner.level]).join()}.{" "}
          {row.management === "self"
            ? "Independent learner"
            : "Guardian-managed learner"}
          .
        </p>
        <p className="mt-4 text-caption">
          Policy: {row.policyVersion}. Synthetic readiness only.
        </p>
        <p className="mt-4 text-body">Status: {row.state}.</p>
        <p className="mt-2 text-body">
          {row.state === "pending"
            ? "Assigned review is required. Learner access is not authorized."
            : row.state === "authorized"
              ? row.currentAccess
                ? "Synthetic learner access is currently authorized."
                : "An authorization decision is recorded, but current learner access is unavailable."
              : "Current learner access is unavailable. The decision history is retained."}
        </p>
      </section>
      <>
        {row.state === "authorized" && row.currentAccess && (
          <LearnerLink
            href="/learners"
            className="action action-primary mt-8"
            label="Your authorized learners"
          />
        )}
        {row.next && (
          <section className="mt-8 max-w-prose">
            <h2 className="text-section-title">
              {selectionFromReturnPath(row.next)
                ? "Your selected tutor and time"
                : "Your selected tutor and subject"}
            </h2>
            <p className="mt-2 text-body">
              The original public selection is retained. Its availability and
              learner authority must be checked again; no time is reserved by
              admission.
            </p>
            <LearnerLink
              className="mt-2 inline-flex min-h-11 items-center"
              href={row.next}
              label={
                selectionFromReturnPath(row.next)
                  ? "Return to selected tutor and time"
                  : "Return to selected tutor and subject"
              }
            />
          </section>
        )}
      </>
    </div>
  );
}
