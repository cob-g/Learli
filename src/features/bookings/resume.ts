import type { AuthRuntime } from "@/lib/auth-factory";
import { filterTutors } from "@/features/tutors/eligibility";
import { readPublicCandidates } from "@/features/public-availability/service";
import {
  loadDemoBookingOptions,
  readDemoCandidates,
  type DemoCandidates,
} from "./service";
import { formatLessonTime } from "./format-time";
import type { PublicBookingSelection } from "./selection";

export async function loadDemoBookingResume(
  runtime: AuthRuntime,
  headers: Headers,
  choice: PublicBookingSelection | null,
) {
  const options = await loadDemoBookingOptions(runtime, headers);
  const empty = {
    options,
    choice: null,
    message: "",
    times: null as DemoCandidates["times"] | null,
    requestedTime: null as ReturnType<typeof formatLessonTime> | null,
  };
  if (!choice) return empty;
  const valid = filterTutors(options.tutors, {
    subject: choice.subjectSlug,
    level: choice.level,
  }).some((tutor) => tutor.slug === choice.tutorSlug);
  if (!valid)
    return {
      ...empty,
      message:
        "This tutor isn't taking simulated bookings for that subject and level right now. Choose another tutor.",
    };
  const requestedTime = formatLessonTime(
    new Date(choice.startAtUtc),
    new Date(choice.endAtUtc),
    choice.displayTimezone,
  );
  if (
    options.learners.length === 1 &&
    options.learners[0].level !== choice.level
  )
    return {
      ...empty,
      choice,
      requestedTime,
      message:
        "The authorized learner's level differs from your preview. Choose a subject offered at this learner's level and load open times.",
    };
  try {
    const preview = await readPublicCandidates(runtime, {
      tutorSlugs: [choice.tutorSlug],
      subjectSlug: choice.subjectSlug,
      level: choice.level,
      displayTimezone: choice.displayTimezone,
    });
    const available = preview.tutors[0].times.some(
      (time) =>
        time.startAtUtc === new Date(choice.startAtUtc).toISOString() &&
        time.endAtUtc === new Date(choice.endAtUtc).toISOString(),
    );
    const times =
      options.learners.length === 1
        ? (
            await readDemoCandidates(runtime, headers, {
              learnerId: options.learners[0].id,
              tutorSlug: choice.tutorSlug,
              subjectSlug: choice.subjectSlug,
              displayTimezone: choice.displayTimezone,
            })
          ).times
        : null;
    const stillAvailable =
      available &&
      (!times ||
        times.some(
          (time) =>
            time.startAtUtc === requestedTime.startAtUtc &&
            time.endAtUtc === requestedTime.endAtUtc,
        ));
    return {
      ...empty,
      choice,
      requestedTime,
      times,
      message: stillAvailable
        ? ""
        : "That time is no longer available. Please choose another from the current open times.",
    };
  } catch {
    return {
      ...empty,
      choice,
      requestedTime,
      message:
        "Open times could not be checked. Choose who this lesson is for and load open times to try again.",
    };
  }
}
