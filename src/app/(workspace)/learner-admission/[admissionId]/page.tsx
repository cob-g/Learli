import {
  privateBookingHref,
  selectionFromReturnPath,
} from "@/features/bookings/selection";
import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { admissionContext } from "@/features/learner-admission/context";
import { readMyAdmission } from "@/features/learner-admission/service";
import { canonicalAdmissionSelection } from "@/features/learner-admission/input";

import { LearnerLink } from "@/features/learners/learner-link";
import { levelNames } from "@/features/subjects/catalog";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { hasPersistentWorkflow } from "@/features/local-workflow/presentation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admission request",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ admissionId: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { admissionId } = await params;
  const incomingNext = canonicalAdmissionSelection((await searchParams).next);
  const query = incomingNext
    ? `?${new URLSearchParams({ next: incomingNext })}`
    : "";
  const result = await loadPrivatePage(
    `/learner-admission/${encodeURIComponent(admissionId)}${query}`,
    async (runtime, headers) => ({
      row: await readMyAdmission(
        admissionContext(runtime),
        headers,
        admissionId,
      ),
      privateWorkflow: hasPersistentWorkflow(runtime),
    }),
  );
  if (!result)
    return (
      <UnavailablePage
        title="Admission unavailable"
        message="We cannot open this admission request on this account."
      />
    );
  const { row, privateWorkflow } = result;
  const parentDeclared =
    row.policyVersion === "local-guardian-admission-v2" &&
    row.management === "guardian";
  const next = incomingNext ?? row.next;
  return (
    <div className="page-shell page-space">
      <LearnerLink
        href={parentDeclared ? "/parent/children" : "/learner-admission"}
        className="inline-flex min-h-11 items-center"
        label={parentDeclared ? "My Children" : "Admission requests"}
      />
      <h1 className="mt-4 text-page-title">
        {parentDeclared ? "Child profile consent record" : "Admission request"}
      </h1>
      <p className="mt-4 max-w-prose text-body">
        {parentDeclared
          ? "This record contains your guardian declaration, consent and current access status for the new child profile. No routine Admin approval is required."
          : privateWorkflow
            ? "This request records the learner’s review status and current access."
            : "Synthetic readiness only. This record establishes no real consent or eligibility."}
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
          {row.learner.grade != null && <>Grade {row.learner.grade}. </>}
          {row.management === "self"
            ? "Independent learner"
            : "Guardian-managed learner"}
          .
        </p>
        <p className="mt-4 text-caption">
          Policy: {row.policyVersion}.
          {!privateWorkflow && " Synthetic readiness only."}
        </p>
        <p className="mt-4 text-body">
          Status:{" "}
          {privateWorkflow
            ? row.state.charAt(0).toUpperCase() + row.state.slice(1)
            : row.state}
          .
        </p>
        <p className="mt-2 text-body">
          {row.state === "pending"
            ? "Assigned review is required. Learner access is not authorized."
            : row.state === "authorized"
              ? row.currentAccess
                ? privateWorkflow
                  ? "Learner access is currently authorized."
                  : "Synthetic learner access is currently authorized."
                : parentDeclared
                  ? "Your guardian declaration and consent are recorded, but current child profile access is unavailable."
                  : "An authorization decision is recorded, but current learner access is unavailable."
              : "Current learner access is unavailable. The decision history is retained."}
        </p>
      </section>
      <>
        {row.state === "authorized" && row.currentAccess && (
          <div className="mt-8 flex flex-wrap items-center gap-6">
            {row.management === "self" && (
              <LearnerLink
                href="/student"
                className="action action-primary"
                label="Student workspace"
              />
            )}
            <LearnerLink
              href="/learners"
              className="action action-primary"
              label="Your authorized learners"
            />
            {privateWorkflow && (
              <LearnerLink
                href="/tutors"
                className="inline-flex min-h-11 items-center"
                label="Find a tutor"
              />
            )}
          </div>
        )}
        {next && (
          <section className="mt-8 max-w-prose">
            <h2 className="text-section-title">
              {selectionFromReturnPath(next)
                ? "Your selected tutor and time"
                : "Your selected tutor and subject"}
            </h2>
            <p className="mt-2 text-body">
              {incomingNext
                ? "This visit’s public selection is retained without changing the saved admission request."
                : "The original public selection is retained."}{" "}
              Its availability and learner authority must be checked again; no
              time is reserved by admission.
            </p>
            <LearnerLink
              className="mt-2 inline-flex min-h-11 items-center"
              href={privateWorkflow ? privateBookingHref(next) : next}
              label={
                selectionFromReturnPath(next)
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
