import "server-only";
import Link from "next/link";
import { getDomainAuthRuntime } from "@/lib/auth";
import { readPublicTutor } from "@/features/tutors/public";
import { levelNames } from "@/features/subjects/catalog";
import { readPublicCandidates } from "@/features/public-availability/service";
import { formatLessonTime } from "./format-time";
import { LessonTime } from "./lesson-time";
import { selectionFromReturnPath } from "./selection";

/** Read-only public selection on auth pages. No authenticated/private data. */
export async function PendingBookingChoice({ next }: { next?: string }) {
  const choice = selectionFromReturnPath(next);
  if (!choice) return null;
  const tutor = await readPublicTutor(choice.tutorSlug);
  const offering = tutor?.offerings.find(
    (row) =>
      row.subjectSlug === choice.subjectSlug &&
      row.levels.includes(choice.level),
  );
  if (!tutor || !offering)
    return (
      <p className="mt-4 max-w-prose text-body">
        This tutor isn&apos;t taking simulated bookings for that choice right
        now. <Link href="/tutors">Browse all tutors</Link>
      </p>
    );
  let message = "Times are checked again after sign-in. No time is reserved.";
  try {
    const runtime = await getDomainAuthRuntime();
    if (!runtime) throw new Error("Local preview unavailable");
    const result = await readPublicCandidates(runtime, {
      tutorSlugs: [choice.tutorSlug],
      subjectSlug: choice.subjectSlug,
      level: choice.level,
      displayTimezone: choice.displayTimezone,
    });
    if (
      !result.tutors[0].times.some(
        (time) =>
          time.startAtUtc === new Date(choice.startAtUtc).toISOString() &&
          time.endAtUtc === new Date(choice.endAtUtc).toISOString(),
      )
    )
      message =
        "That time is no longer available. Sign in to choose another time.";
  } catch {
    message = "Open times could not be checked. Try again after sign-in.";
  }
  return (
    <section
      aria-labelledby="pending-booking-title"
      className="mt-4 space-y-2 border-b border-border pb-4"
    >
      <h2 id="pending-booking-title" className="text-item-title">
        Your simulated booking choice
      </h2>
      <p className="text-body">
        {tutor.displayName} · {offering.subjectName} ·{" "}
        {levelNames([choice.level]).join()}
      </p>
      <LessonTime
        value={formatLessonTime(
          new Date(choice.startAtUtc),
          new Date(choice.endAtUtc),
          choice.displayTimezone,
        )}
      />
      <p className="text-small">{message}</p>
    </section>
  );
}
