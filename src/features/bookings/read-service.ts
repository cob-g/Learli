// Public Node-only service; routes/pages/tests only. Client imports model types.
import { z } from "zod";
import type { AuthRuntime } from "@/lib/auth-factory";
import { AccessError } from "@/lib/permissions/access";
import { isLoopbackOrigin, syntheticEmail } from "@/lib/local-mode";
import { isValidTimeZone } from "@/lib/time/time-zone";
import {
  bookingListInput,
  bookingOverviewInput,
  bookingReadScope,
  type BookingListInput,
} from "./read-input";
import { projectBookingRead } from "./read-projection";
import { queryParticipantBookings, type ReadSnapshot } from "./read-query";
import type { StoredBookingRead } from "./read-projection";
import type {
  BookingDetail,
  BookingPage,
  BookingReadScope,
  BookingOverview,
} from "./read-model";

async function readActor(runtime: AuthRuntime, headers: Headers) {
  if (
    !["development", "test"].includes(runtime.environment) ||
    !isLoopbackOrigin(runtime.origin)
  )
    throw new AccessError(503);
  const current = await runtime.auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
  });
  if (!current) throw new AccessError(401);
  if (!syntheticEmail(current.user.email)) throw new AccessError(404);
  // These identifiers come only from the provider. Final SQL rechecks everything.
  return { userId: current.user.id, sessionId: current.session.id };
}

export async function listParticipantBookings(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown,
): Promise<BookingPage> {
  const actor = await readActor(runtime, headers);
  const values = bookingListInput.parse(input);
  const snapshot = await queryParticipantBookings(runtime.db, actor, values);
  if (!snapshot || !isValidTimeZone(snapshot.timezone))
    throw new AccessError(404);
  return projectPage(snapshot, values, snapshot.items);
}

function projectPage(
  snapshot: ReadSnapshot,
  values: BookingListInput,
  items: StoredBookingRead[],
): BookingPage {
  const now = new Date(snapshot.snapshot);
  return {
    learners: snapshot.learners,
    items: items.slice(0, values.pageSize).map((row) => {
      const { events, ...summary } = projectBookingRead(
        row,
        snapshot.timezone,
        now,
      );
      // Lists have no event projection; detail owns persisted history.
      void events;
      return summary;
    }),
    scope: values.scope,
    filter: values.filter,
    page: values.page,
    pageSize: values.pageSize,
    hasNext: items.length > values.pageSize,
    viewerTimezone: snapshot.timezone,
    snapshotAtUtc: now.toISOString(),
  };
}

export async function listParticipantBookingOverview(
  runtime: AuthRuntime,
  headers: Headers,
  input: unknown,
): Promise<BookingOverview> {
  const actor = await readActor(runtime, headers);
  const values = bookingOverviewInput.parse(input);
  const snapshot = await queryParticipantBookings(
    runtime.db,
    actor,
    { ...values, filter: "all" },
    undefined,
    true,
  );
  if (!snapshot || !isValidTimeZone(snapshot.timezone))
    throw new AccessError(404);
  return {
    active: projectPage(
      snapshot,
      { ...values, page: 1, filter: "active" },
      snapshot.activeItems,
    ),
    history: projectPage(
      snapshot,
      { ...values, filter: "history" },
      snapshot.historyItems,
    ),
  };
}

export async function readParticipantBooking(
  runtime: AuthRuntime,
  headers: Headers,
  bookingId: string,
  scope: BookingReadScope,
): Promise<BookingDetail> {
  const actor = await readActor(runtime, headers);
  if (
    !z.uuid().safeParse(bookingId).success ||
    !bookingReadScope.safeParse(scope).success
  )
    throw new AccessError(404);
  const snapshot = await queryParticipantBookings(
    runtime.db,
    actor,
    { scope, filter: "all", page: 1, pageSize: 1 },
    bookingId,
  );
  if (!snapshot?.items[0] || !isValidTimeZone(snapshot.timezone))
    throw new AccessError(404);
  return projectBookingRead(
    snapshot.items[0],
    snapshot.timezone,
    new Date(snapshot.snapshot),
  );
}
