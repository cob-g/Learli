import "server-only";
import type { AuthRuntime } from "@/lib/auth-factory";
import { listParticipantBookingOverview } from "@/features/bookings/read-service";
import {
  bookingDetailPath,
  type BookingSummary,
} from "@/features/bookings/read-model";
import { levelNames } from "@/features/subjects/catalog";
import { readOwnTutorProfile } from "./service";
import type { TutorAgendaBooking } from "./booking-agenda";

/** Tutor-page composition only; all booking access/query/TTL semantics remain provider-owned. */
export async function readTutorBookingWorkspace(
  runtime: AuthRuntime,
  headers: Headers,
) {
  const profile = await readOwnTutorProfile(runtime, headers);
  // No profile means no assigned tutor FK can exist. Preserve the guarded first-use profile flow.
  const overview = profile
    ? await listParticipantBookingOverview(runtime, headers, { scope: "tutor" })
    : null;
  return { profile, overview };
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
