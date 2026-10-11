import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";

export default function Home() {
  return (
    <>
      <section data-surface="inverse">
        <div className="page-shell py-16 md:py-24">
          <h1 className="max-w-3xl text-display">
            Find a tutor for one-to-one online lessons
          </h1>
          <p className="mt-4 max-w-xl text-lead text-on-inverse-muted">
            For Elementary, Middle School, High School, and College Support
            learners. Lessons take place with your tutor on Zoom or Google Meet.
          </p>
          <div className="mt-8 border-t border-on-inverse-muted pt-8">
            <EmptyState title="No tutors are listed right now">
              <p>
                Learli is preparing to welcome tutors. Booking is not available
                yet.
              </p>
            </EmptyState>
          </div>
        </div>
      </section>
      <div className="page-shell py-16 md:py-24">
        <h2 className="text-headline">Tutoring through Learli</h2>
        <div className="mt-4 grid gap-8 md:grid-cols-2">
          <p className="max-w-prose text-prose">
            Learli brings tutor discovery and lesson coordination into one
            place. You can <Link href="/tutors">find a tutor</Link> or{" "}
            <Link href="/get-matched">get matched</Link> when tutors are
            available.
          </p>
          <p className="max-w-prose text-prose">
            Your tutor provides the teaching and learning materials. Your lesson
            happens outside Learli, on Zoom or Google Meet.
          </p>
        </div>
        <Link
          href="/how-it-works"
          className="mt-8 inline-flex min-h-11 items-center"
        >
          How it works
        </Link>
      </div>
    </>
  );
}
