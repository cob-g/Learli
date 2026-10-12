import type { Metadata } from "next";
import Link from "next/link";

// Open items summarize canonical PRD §7 PUB-05 and §§11, 17–18.
// These descriptions record questions; they never establish customer policy.
export const draftPolicies = {
  privacy: {
    title: "Privacy draft",
    description:
      "Privacy preparation for Learli's synthetic local demo. Real data-handling decisions remain open.",
    introduction:
      "This is preparation information, not a final Privacy Notice. Real-user privacy and safeguarding decisions still require review before launch.",
    localBehavior:
      "Development and test use synthetic accounts and learners on the local loopback app, with .test email addresses. Private learner, booking and meeting information is limited to authorized accounts. Email is captured locally; it is not sent to customers.",
    openItems: [
      "Operating jurisdiction and initial learner and tutor markets, and the data-protection requirements that apply there.",
      "Minor eligibility, guardian authorization and consent, and whether young learners have separate logins.",
      "The minimum tutor and learner profile fields needed for real use.",
      "Record-retention periods and procedures for data access and deletion requests.",
      "Privacy and consent notices, responsible contacts, and incident-response ownership and procedures.",
    ],
    references: "PRD FAM-01/04; sections 11.2–11.4 and 18.",
  },
  terms: {
    title: "Terms draft",
    description:
      "Terms preparation for Learli's synthetic local demo. Operating and commercial decisions remain open.",
    introduction:
      "This is preparation information, not final Terms of Service. It records unresolved operating and business decisions and does not ask you to accept terms.",
    localBehavior:
      "The local loopback app demonstrates tutor discovery and booking coordination using synthetic .test accounts and simulated records. A simulation does not establish a real lesson, payment or attendance. Lessons are intended to happen outside Learli on Zoom or Google Meet; local email capture is not delivery.",
    openItems: [
      "The operating legal entity, jurisdiction and initial learner and tutor markets.",
      "Who receives customer money, and whether the offer is individual lessons, packages, subscriptions or a trial or assessment.",
      "Prices and who sets them, currencies, fees, commissions, tutor compensation, payouts, taxes and payment-provider eligibility.",
      "Tutor eligibility and safeguarding screening, guardian and learner access rules, and the responsible support and incident-escalation owners.",
      "Meeting-link handling, third-party meeting settings and guardian oversight requirements.",
      "Review eligibility, visibility, moderation and disputes, and reviewed customer terms and complaint contacts.",
    ],
    references:
      "PRD TUT-01, FAM-01/04, MEET-01/03, OPS-05/06, PAY-01; sections 11.3 and 18.",
  },
  cancellations: {
    title: "Cancellations draft",
    description:
      "Cancellation preparation for Learli's synthetic local demo. Real change, refund and no-show rules remain open.",
    introduction:
      "This is preparation information, not a final cancellation or refund policy. No customer cancellation window, refund entitlement or credit promise has been approved here.",
    localBehavior:
      "Reservations in the local loopback development and test app use synthetic .test accounts and visibly simulated states. Any local timing or change controls are demonstration behavior, not customer terms. Payments are deferred; the demo does not charge money or issue refunds.",
    openItems: [
      "Who may cancel or reschedule, applicable cutoffs, and how tutor cancellations and disputed bookings are handled.",
      "Late-arrival and no-show rules and their effect on booking status.",
      "Refunds, credits, trial or assessment terms, and chargeback responsibilities under the eventual commercial model.",
      "Real lesson duration, advance notice, provisional holds and expiration, and the conditions for a confirmed booking.",
      "Reviewed cancellation and rescheduling disclosures and the responsible customer-support process before live changes are enabled.",
    ],
    references: "PRD BKG-03/05/06/07, PAY-01, BR-10; sections 11.3 and 18.",
  },
} as const;

export type DraftPolicy = keyof typeof draftPolicies;

export function draftPolicyMetadata(policy: DraftPolicy): Metadata {
  const content = draftPolicies[policy];
  return {
    title: content.title,
    description: content.description,
    robots: { index: false, follow: false },
  };
}

export function DraftPolicyPage({ policy }: { policy: DraftPolicy }) {
  const content = draftPolicies[policy];
  return (
    <div className="page-shell page-space">
      <article className="max-w-prose">
        <h1 className="text-page-title">{content.title}</h1>
        <p className="mt-4 max-w-prose text-prose">{content.introduction}</p>
        <p className="mt-4 max-w-prose text-prose text-muted-foreground">
          Draft for local preparation only. This page is not legal advice or
          approval to launch with real learners.
        </p>
        <section className="mt-8" aria-labelledby="local-behavior">
          <h2 id="local-behavior" className="text-section-title">
            Current local behavior
          </h2>
          <p className="mt-4 max-w-prose text-prose">{content.localBehavior}</p>
        </section>
        <section className="mt-8" aria-labelledby="open-decisions">
          <h2 id="open-decisions" className="text-section-title">
            Decisions still open
          </h2>
          <ul className="mt-4 list-disc space-y-4 pl-6 text-prose">
            {content.openItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-4 max-w-prose text-small text-muted-foreground">
            Preparation topics from Learli&apos;s product requirements:{" "}
            {content.references}
          </p>
        </section>
        <section className="mt-8" aria-labelledby="before-launch">
          <h2 id="before-launch" className="text-section-title">
            Before real use
          </h2>
          <p className="mt-4 max-w-prose text-prose">
            Founders and the responsible qualified reviewers must resolve the
            relevant decisions and review actual policies before public use.
            Local feature checks do not complete that signoff. Payments and real
            minor onboarding remain gated.
          </p>
          <p className="mt-4 max-w-prose text-prose">
            <Link className="text-link" href="/contact">
              Contact support
            </Link>
            {" and "}
            <Link className="text-link" href="/report-a-concern">
              Report a concern
            </Link>
            {
              " lead to synthetic local demonstrations. They are not monitored and are not emergency channels."
            }
          </p>
        </section>
      </article>
    </div>
  );
}
