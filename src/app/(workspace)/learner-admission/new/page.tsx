import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { admissionContext } from "@/features/learner-admission/context";
import { readAdmissionIntake } from "@/features/learner-admission/service";
import { canonicalAdmissionSelection } from "@/features/learner-admission/input";
import { AdmissionForm } from "@/features/learner-admission/forms";
import { LearnerLink } from "@/features/learners/learner-link";
import { listTimeZoneOptions } from "@/lib/time/zones";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Request learner admission",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = canonicalAdmissionSelection((await searchParams).next);
  const path = next
    ? `/learner-admission/new?next=${encodeURIComponent(next)}`
    : "/learner-admission/new";
  const context = await loadPrivatePage(path, (runtime, headers) =>
    readAdmissionIntake(admissionContext(runtime), headers),
  );
  if (!context)
    return (
      <UnavailablePage
        title="Admission unavailable"
        message="We cannot open admission intake on this account."
      />
    );
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Request learner admission</h1>
      <p className="mt-4 max-w-prose text-body">
        Real admission is disabled until current guardian and independent
        eligibility policies are approved.
      </p>
      {context.enabled ? (
        <>
          <p className="mt-4 max-w-prose text-body">
            Synthetic readiness only. Use fictional details. A review does not
            establish real age, consent or guardian identity.
          </p>
          <AdmissionForm
            requestId={randomUUID()}
            policyVersion={context.policyVersion}
            policyDigest={context.policyDigest}
            zones={listTimeZoneOptions(new Date(), ["UTC"])}
            next={next ?? undefined}
          />
        </>
      ) : (
        <p className="mt-8 max-w-prose text-body">
          Admission intake is unavailable. No learner details are collected.
        </p>
      )}
      {next && (
        <LearnerLink
          href={next}
          label="Return to selected tutor and time"
          className="mt-8 inline-flex min-h-11 items-center"
        />
      )}
      <LearnerLink
        href="/learner-admission"
        label="Your admission requests"
        className="ms-4 mt-8 inline-flex min-h-11 items-center"
      />
    </div>
  );
}
