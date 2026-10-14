import Link from "next/link";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata = publicPageMetadata({
  title: "How it works",
  description:
    "Find a tutor for your subject, choose an available time, and meet for a one-to-one lesson on Zoom or Google Meet. Tutors teach independently.",
  path: "/how-it-works",
});

export default function HowItWorksPage() {
  return (
    <div className="page-shell page-space">
      <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h1 className="text-headline">Find a tutor. Choose a time.</h1>
          <p className="mt-6 max-w-prose font-reading text-reading">
            Learli helps you find one-to-one tutoring for Elementary, Middle
            School, High School and College Support. Tutors teach independently
            on Zoom or Google Meet.
          </p>
          <p className="mt-6 max-w-prose text-body text-muted-foreground">
            This development preview uses simulated bookings. Live lesson terms
            are not set.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Link href="/tutors" className="action action-primary">
              Find a tutor
            </Link>
            <Link
              href="/get-matched"
              className="inline-flex min-h-12 items-center"
            >
              Get matched
            </Link>
          </div>
        </div>
        <ol className="divide-y divide-border border-y border-border">
          <li className="py-6">
            <h2 className="text-section-title">
              Find a tutor for your subject
            </h2>
            <p className="mt-4 font-reading text-reading">
              Browse the subjects and learner levels each tutor offers, or
              answer the short matching questions.
            </p>
          </li>
          <li className="py-6">
            <h2 className="text-section-title">Choose an available time</h2>
            <p className="mt-4 font-reading text-reading">
              A parent or guardian arranges lessons for their authorized
              learner. Eligible college learners can manage their own lessons.
            </p>
          </li>
          <li className="py-6">
            <h2 className="text-section-title">Meet on Zoom or Google Meet</h2>
            <p className="mt-4 font-reading text-reading">
              Your tutor provides the teaching and materials. Meeting details
              belong to the private booking, rather than the public profile.
            </p>
          </li>
        </ol>
      </div>
    </div>
  );
}
