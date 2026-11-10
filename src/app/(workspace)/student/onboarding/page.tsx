import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { LearnerLink } from "@/features/learners/learner-link";
import { readStudentOnboarding } from "@/features/student-onboarding/read";
import {
  independentAdmissionHref,
  studentContinuation,
  studentAdmissionRequestHref,
  studentOnboardingHref,
} from "@/features/student-onboarding/continuation";
import { IndependentLearnerForm } from "@/features/independent-learner/form";
import { listTimeZoneOptions } from "@/lib/time/zones";
import { randomUUID } from "node:crypto";
import { GraduationCap } from "lucide-react";
import "@/features/parent-children/parent-pages.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Set up your Student profile",
  robots: { index: false, follow: false },
};
export default async function StudentOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = (await searchParams).next;
  const context = await loadPrivatePage(
    studentOnboardingHref(next),
    readStudentOnboarding,
  );
  if (!context)
    return (
      <UnavailablePage
        title="College Student setup unavailable"
        message="Verify your email and check your account access before continuing."
      />
    );
  if (context.admissionId)
    redirect(studentAdmissionRequestHref(context.admissionId, next));
  if (context.existingLearnerId) {
    const destination = studentContinuation(next);
    redirect(destination === "/account" ? "/student" : destination);
  }
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">Student workspace</p>
          {/* Ordinary local V2 creates the profile directly; the earlier private
            path still sends a request for an assigned review (ui-context). */}
          {context.kind === "independent" ? (
            <>
              <h1>Set up your Student profile</h1>
              <p>
                Create your own College Support learner profile when you are
                legally eligible to manage a tutoring account independently.
              </p>
              <p className="mt-2 text-small text-muted-foreground">
                College Support is an education level. It does not establish
                that you are an adult or otherwise legally eligible, and this
                setup does not create a guardian relationship.
              </p>
            </>
          ) : (
            <>
              <h1>Set up College Student</h1>
              <p>
                Request your own College Support learner profile. Choosing
                College Student does not grant a workspace or booking access.
              </p>
              <p className="mt-2 text-small text-muted-foreground">
                An assigned reviewer must authorize independent eligibility. A
                pending request does not grant learner access, and no guardian
                relationship is created for an independent learner.
              </p>
            </>
          )}
        </div>
        <Link href="/account" className="pp-link">
          Back to account settings
        </Link>
      </header>
      <div className="max-w-xl">
        {context.enabled ? (
          context.kind === "independent" ? (
            <IndependentLearnerForm
              requestId={randomUUID()}
              policyVersion={context.policyVersion}
              policyDigest={context.policyDigest}
              noticeVersion={context.noticeVersion}
              timezone={context.timezone}
              zones={listTimeZoneOptions(new Date(), [context.timezone])}
              next={
                studentContinuation(next) === "/account"
                  ? undefined
                  : studentContinuation(next)
              }
            />
          ) : (
            <>
              <section className="pp-card">
                <div className="pp-card-body flex flex-col gap-4">
                  <p className="pp-help">
                    <span className="pp-icon" aria-hidden="true">
                      <GraduationCap size={18} />
                    </span>
                    <span>
                      Use fictional details in private staging. This review does
                      not establish real age, identity or eligibility. Your
                      selected tutor and time will be checked again; no time is
                      reserved.
                    </span>
                  </p>
                  <LearnerLink
                    className="action action-primary pp-submit"
                    href={independentAdmissionHref(next)}
                    label="Request independent admission"
                  />
                </div>
              </section>
            </>
          )
        ) : (
          <p className="workspace-page-note">
            Independent Student setup is unavailable. No learner details are
            collected. Check your account status or return later.
          </p>
        )}
      </div>
    </div>
  );
}
