import "server-only";
import type { AuthRuntime } from "@/lib/auth-factory";
import { listParticipantBookingOverview } from "@/features/bookings/read-service";
import {
  bookingDetailPath,
  type BookingSummary,
} from "@/features/bookings/read-model";
import { levelNames } from "@/features/subjects/catalog";
import { readOwnAvailability } from "@/features/availability/service";
import { getScreeningContext } from "@/features/tutor-screening/composition";
import { readScreening } from "@/features/tutor-screening/service";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import {
  assertPrivateWorkflowUnchanged,
  getPrivateWorkflow,
} from "@/features/private-workflow/runtime";
import { readOwnTutorProfile } from "./service";
import { findEligibleTutor } from "./eligibility";
import { buildTutorReadiness } from "./readiness-summary";
import type { TutorAgendaBooking } from "./booking-agenda";

/** Tutor-page composition only; all booking access/query/TTL semantics remain provider-owned. */
export async function readTutorBookingWorkspace(
  runtime: AuthRuntime,
  headers: Headers,
) {
  const profile = await readOwnTutorProfile(runtime, headers);
  // No profile means no assigned tutor FK can exist. Preserve the guarded first-use profile flow.
  if (!profile)
    return {
      profile,
      overview: null,
      readiness: buildTutorReadiness({
        profile: null,
        screening: null,
        screeningAvailable:
          getScreeningContext(runtime).screening.mode !== "disabled",
        hasAvailability: false,
        publicListing: false,
      }),
    };
  const overview = await listParticipantBookingOverview(runtime, headers, {
    scope: "tutor",
  });
  const packet = getPrivateWorkflow(runtime);
  const localWorkflow = getLocalWorkflow(runtime) !== null;
  const screeningContext = getScreeningContext(runtime);
  const [screening, availability, publicTutor] = await Promise.all([
    screeningContext.screening.mode === "disabled"
      ? null
      : readScreening(screeningContext, headers, profile.id, "owner"),
    readOwnAvailability(runtime, headers),
    findEligibleTutor(
      runtime.db,
      profile.slug,
      localWorkflow
        ? "local_operation"
        : packet
          ? "synthetic_readiness"
          : "local_demo",
      packet,
    ),
  ]);
  assertPrivateWorkflowUnchanged(runtime, packet);
  return {
    profile,
    overview,
    readiness: buildTutorReadiness({
      profile,
      screening,
      screeningAvailable: screeningContext.screening.mode !== "disabled",
      hasAvailability: (availability?.windows.length ?? 0) > 0,
      publicListing: publicTutor !== null,
    }),
  };
}

export function tutorAgendaBooking(
  booking: BookingSummary,
): TutorAgendaBooking {
  return {
    id: booking.id,
    detailHref: bookingDetailPath(booking.id, "tutor"),
    state: booking.state,
    learnerLabel: booking.learner.displayName,
    learnerLevel: levelNames([booking.learner.level]).join(),
    subject: booking.subject.name,
    time: booking.time,
    expiry: booking.expires,
  };
}
