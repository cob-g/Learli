import "server-only";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { getAuthRuntime } from "@/lib/auth";
import { tutorProfiles } from "@/lib/db/schema";
import { isValidTimeZone } from "@/lib/time/time-zone";
import { timeZoneLabel } from "@/lib/time/zones";
import type { PublicTutor } from "@/features/tutors/eligibility";
import { publicLevelInput, publicSlugInput, publicZoneInput } from "./input";
import { readPublicCandidates, type PublicTutorCandidates } from "./service";
import { parseVisitTimeZone, visitTimeZoneKey } from "./visit-timezone";
import {
  publicBookingSelectionInput,
  type SearchValues,
} from "@/features/bookings/selection";

export type ProfilePreview = {
  subjectSlug: string;
  level: string;
  timezone: string;
  zoneLabel: string;
  needsBrowserZone: boolean;
  explicitZone: boolean;
  message: string;
  candidates: PublicTutorCandidates | null;
  selectedStart: string;
};

export async function loadProfilePreview(
  tutor: PublicTutor,
  params: SearchValues,
): Promise<ProfilePreview> {
  const subject = publicSlugInput.safeParse(
    params.subject ?? params.subjectSlug,
  );
  const level = publicLevelInput.safeParse(params.level);
  const zone = publicZoneInput.safeParse(params.displayTimezone);
  const runtime = getAuthRuntime();
  let savedZone: string | undefined;
  if (runtime && !zone.success) {
    try {
      const session = await runtime.auth.api.getSession({
        headers: await headers(),
      });
      if (session && isValidTimeZone(session.user.timezone))
        savedZone = session.user.timezone;
    } catch {
      /* Public browsing does not require an account. */
    }
  }
  const visitZone =
    !zone.success && !savedZone
      ? parseVisitTimeZone((await cookies()).get(visitTimeZoneKey)?.value)
      : undefined;
  let teachingZone = "UTC";
  if (runtime && !zone.success && !savedZone && !visitZone) {
    try {
      const [profile] = await runtime.db
        .select({ timezone: tutorProfiles.timezone })
        .from(tutorProfiles)
        .where(eq(tutorProfiles.slug, tutor.slug))
        .limit(1);
      if (profile && isValidTimeZone(profile.timezone))
        teachingZone = profile.timezone;
    } catch {
      /* The candidate read below supplies a distinct failure state. */
    }
  }
  // Only a public teaching-zone fallback leaves this wrapper; no private records.
  const timezone = zone.success
    ? zone.data
    : (savedZone ?? visitZone ?? teachingZone);
  const result: ProfilePreview = {
    subjectSlug: subject.success ? subject.data : "",
    level: level.success ? level.data : "",
    timezone,
    zoneLabel: timeZoneLabel(timezone),
    needsBrowserZone: !zone.success && !savedZone && !visitZone,
    explicitZone: zone.success,
    message: "",
    candidates: null,
    selectedStart: "",
  };
  if (params.displayTimezone && !zone.success)
    result.message = "Choose a valid time zone, then load open times.";
  if (!subject.success || !level.success) return result;
  if (
    !tutor.offerings.some(
      (offering) =>
        offering.subjectSlug === subject.data &&
        offering.levels.includes(level.data),
    )
  ) {
    result.message =
      "This tutor does not offer that subject at the selected level. Choose another subject or level.";
    return result;
  }
  if (!runtime) {
    result.message = "Local simulated open times are unavailable.";
    return result;
  }
  try {
    result.candidates = (
      await readPublicCandidates(runtime, {
        tutorSlugs: [tutor.slug],
        subjectSlug: subject.data,
        level: level.data,
        displayTimezone: timezone,
      })
    ).tutors[0];
    if (params.startAtUtc || params.endAtUtc) {
      const choice = publicBookingSelectionInput.safeParse({
        tutorSlug: tutor.slug,
        subjectSlug: result.subjectSlug,
        level: result.level,
        displayTimezone: timezone,
        startAtUtc: params.startAtUtc,
        endAtUtc: params.endAtUtc,
      });
      const selected = choice.success
        ? result.candidates.times.find(
            (time) =>
              time.startAtUtc ===
                new Date(choice.data.startAtUtc).toISOString() &&
              time.endAtUtc === new Date(choice.data.endAtUtc).toISOString(),
          )
        : undefined;
      if (selected) result.selectedStart = selected.startAtUtc;
      else
        result.message =
          "That time is no longer available. Please choose another from the current open times.";
    }
  } catch {
    result.message =
      "Open times could not be loaded. Try again, or contact support if this keeps happening.";
  }
  return result;
}
