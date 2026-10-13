import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { admissionContext } from "@/features/learner-admission/context";
import { readAssignedAdmission } from "@/features/learner-admission/service";
import { AdmissionReviewForms } from "@/features/learner-admission/forms";
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
    `/admin/learner-admission/${admissionId}`,
    (runtime, headers) =>
      readAssignedAdmission(admissionContext(runtime), headers, admissionId),
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
        href="/admin/learner-admission"
        className="inline-flex min-h-11 items-center"
        label="Admission requests"
      />
      <h1 className="mt-4 text-page-title">Admission request</h1>
      <p className="mt-4 max-w-prose text-body">
        Synthetic readiness only. This record establishes no real consent or
        eligibility.
      </p>
      <h2 className="mt-8 text-section-title">{row.learner.displayName}</h2>
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
            ? "An authorization decision is recorded. Current learner access is checked separately on each request."
            : "Current learner access is unavailable. The decision history is retained."}
      </p>
      <AdmissionReviewForms admission={row} />
    </div>
  );
}
