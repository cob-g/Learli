import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "How it works" };

export default function HowItWorksPage() {
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">How tutoring will work</h1>
      <p className="mt-4 max-w-prose text-prose text-muted-foreground">
        Tutors and booking are not available yet. Here is the experience Learli
        is preparing.
      </p>
      <ol className="mt-8 max-w-prose list-decimal space-y-4 pl-6 text-prose">
        <li>Find a tutor for your subject and learning level.</li>
        <li>
          Choose an available time. A parent or guardian arranges lessons for
          their learner; eligible college learners can manage their own lessons.
        </li>
        <li>
          Meet your tutor on Zoom or Google Meet. Your tutor provides the
          teaching and materials.
        </li>
      </ol>
      <Link href="/tutors" className="action action-outline mt-8">
        Find a tutor
      </Link>
    </div>
  );
}
