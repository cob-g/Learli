import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, afterAll, it, expect } from "vitest";
import {
  openWorld,
  closeWorld,
  createAccount,
  jsonRequest,
  password,
  type World,
  type TestAccount,
} from "./support";
import { familyLearner, familyReservation } from "../support/family-fixtures";
import {
  provisionRestrictionTarget,
  authorizeRestrictionTarget,
} from "@/features/account-restrictions/fixture-tooling";
import { changeAccess } from "@/features/account-restrictions/service";
import {
  readPrivateMeetingLink,
  savePrivateMeetingLink,
} from "@/features/booking-meeting-links/service";
import { createCase, readCase } from "@/features/support/service";
import {
  authorizeFixtureReviewer,
  assignFixtureCase,
} from "@/features/support/fixture-tooling";
import { handleAccountPassword } from "@/features/account-password/handler";
import { handleAuthRequest } from "@/lib/auth-handler";
import {
  readParticipantBooking,
  listParticipantBookings,
} from "@/features/bookings/read-service";
import { handleAccountRequest } from "@/features/account/handler";
import { handleTutorProfileRequest } from "@/features/tutors/handler";
import { dispatchPendingBookingNotices } from "@/features/booking-notifications/dispatch";
import {
  bookingNoticeKey,
  bookingNoticeMailbox,
} from "@/features/booking-notifications/local-capture";
let world: World;
const privateUrl = "https://zoom.us/j/12345678901?pwd=combinedPrivateTest";
const newPassword = "Synthetic-combined-rotated-password-123";
beforeAll(() => {
  world = openWorld();
});
afterAll(() => closeWorld(world));
async function fixture() {
  const parent = await createAccount(world, ["parent"]);
  const tutor = await createAccount(world, ["tutor"]);
  const staff = await createAccount(world, ["admin"]);
  const learnerId = await familyLearner(
    world.owner.pool,
    parent.id,
    "guardian",
    "PRIVATE COMBINED LEARNER",
  );
  const profileId = (
    await world.owner.pool.query(
      "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,'Synthetic tutor','Synthetic only','Fixture','UTC','approved') RETURNING id",
      [tutor.id, `combined-${randomUUID()}`],
    )
  ).rows[0].id as string;
  await authorizeFixtureReviewer(world.owner, staff.id);
  for (const actor of [parent, tutor]) {
    await provisionRestrictionTarget(world.owner, actor.id);
    await authorizeRestrictionTarget(world.owner, staff.id, actor.id);
  }
  const bookingId = await familyReservation(world.owner.pool, {
    actorId: parent.id,
    learnerId,
    tutorId: profileId,
  });
  await savePrivateMeetingLink(world.runtime, tutor.headers, bookingId, {
    url: privateUrl,
    expectedRevision: 0,
    requestId: randomUUID(),
  });
  const report = {
    requestKey: randomUUID(),
    category: "general",
    subject: "Synthetic combined issue",
    body: "Fictional local integration only",
    bookingId,
  };
  const caseId = (await createCase(world.runtime, parent.headers, report)).id;
  await assignFixtureCase(world.owner, caseId, staff.id);
  return {
    parent,
    tutor,
    staff,
    learnerId,
    profileId,
    bookingId,
    caseId,
    report,
  };
}
function access(
  staff: TestAccount,
  target: TestAccount,
  revision: number,
  status: "active" | "suspended",
) {
  return changeAccess(world.runtime, staff.headers, target.id, {
    revision,
    status,
    reason: status === "active" ? "local_restore_test" : "local_access_test",
    requestKey: randomUUID(),
  });
}
function rotate(actor: TestAccount) {
  return handleAccountPassword(
    world.runtime,
    jsonRequest(world, "/api/account/password", {
      cookie: actor.cookie,
      body: {
        currentPassword: password,
        newPassword,
        confirmPassword: newPassword,
      },
    }),
  );
}
async function signIn(actor: TestAccount, value = password) {
  return handleAuthRequest(
    world.runtime,
    jsonRequest(world, "/api/auth/sign-in/email", {
      body: { email: actor.email, password: value },
    }),
  );
}
async function facts(bookingId: string) {
  return (
    await world.owner.pool.query(
      "SELECT (SELECT to_jsonb(b) FROM bookings b WHERE id=$1) AS booking,(SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM booking_events e WHERE booking_id=$1) AS events",
      [bookingId],
    )
  ).rows[0];
}
it("scoped suspension refuses stored sessions at joint boundaries; restore and password replacement cookie preserve exact authority", async () => {
  const f = await fixture();
  const before = await facts(f.bookingId);
  const sessions = (
    await world.owner.pool.query(
      "SELECT count(*)::int AS n FROM session WHERE user_id=$1",
      [f.parent.id],
    )
  ).rows[0].n;
  await access(f.staff, f.parent, 0, "suspended");
  expect(
    (
      await world.owner.pool.query(
        "SELECT count(*)::int AS n FROM session WHERE user_id=$1",
        [f.parent.id],
      )
    ).rows[0].n,
  ).toBe(sessions);
  await expect(
    readPrivateMeetingLink(world.runtime, f.parent.headers, f.bookingId),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    readParticipantBooking(
      world.runtime,
      f.parent.headers,
      f.bookingId,
      "guardian",
    ),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    readCase(world.runtime, f.parent.headers, f.caseId, "requester"),
  ).rejects.toMatchObject({ status: 403 });
  expect(
    (await readCase(world.runtime, f.staff.headers, f.caseId, "reviewer"))
      .booking,
  ).toEqual({ available: false });
  expect((await rotate(f.parent)).status).toBe(403);
  expect(
    (
      await handleAccountRequest(
        world.runtime,
        jsonRequest(world, "/api/account", {
          method: "PATCH",
          cookie: f.parent.cookie,
          body: { name: "Changed", timezone: "UTC" },
        }),
        f.parent.id,
      )
    ).status,
  ).toBe(403);
  expect((await signIn(f.parent)).status).toBe(403);
  expect(await facts(f.bookingId)).toEqual(before);
  await access(f.staff, f.parent, 1, "active");
  expect(
    (await readPrivateMeetingLink(world.runtime, f.parent.headers, f.bookingId))
      .state,
  ).toBe("present");
  expect(
    (await readCase(world.runtime, f.staff.headers, f.caseId, "reviewer"))
      .booking?.available,
  ).toBe(true);
  const second = await signIn(f.parent);
  expect(second.status).toBe(200);
  const secondCookie = second.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const changed = await rotate(f.parent);
  expect(changed.status).toBe(200);
  expect(await changed.json()).toEqual({ status: true });
  const replacement = changed.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  expect(replacement.length > 0).toBe(true);
  for (const cookie of [f.parent.cookie, secondCookie])
    await expect(
      readPrivateMeetingLink(
        world.runtime,
        new Headers({ cookie }),
        f.bookingId,
      ),
    ).rejects.toMatchObject({ status: 401 });
  expect(
    (
      await readPrivateMeetingLink(
        world.runtime,
        new Headers({ cookie: replacement }),
        f.bookingId,
      )
    ).state,
  ).toBe("present");
  expect((await signIn(f.parent)).status).toBe(401);
  expect((await signIn(f.parent, newPassword)).status).toBe(200);
  expect(await facts(f.bookingId)).toEqual(before);
}, 60000);
it("joint support and notification projections exclude saved URLs and lose requester or reviewer authority immediately", async () => {
  const f = await fixture();
  const detail = await readCase(
    world.runtime,
    f.staff.headers,
    f.caseId,
    "reviewer",
  );
  const list = await listParticipantBookings(world.runtime, f.parent.headers, {
    scope: "guardian",
    filter: "all",
  });
  for (const value of [
    privateUrl,
    "combinedPrivateTest",
    "PRIVATE COMBINED LEARNER",
  ])
    expect(JSON.stringify(detail.booking)).not.toContain(value);
  expect(JSON.stringify(list)).not.toContain(privateUrl);
  const eventId = (
    await world.owner.pool.query(
      "SELECT id FROM booking_events WHERE booking_id=$1 AND event='demo_reserved'",
      [f.bookingId],
    )
  ).rows[0].id as string;
  await access(f.staff, f.parent, 0, "suspended");
  expect(
    await dispatchPendingBookingNotices(world.runtime, { eventId }),
  ).toMatchObject({ captured: 1, suppressed: 1, retryable: 0 });
  const html = await readFile(
    path.join(
      bookingNoticeMailbox("test"),
      `${bookingNoticeKey(eventId, f.tutor.id)}.html`,
    ),
    "utf8",
  );
  for (const value of [
    privateUrl,
    "combinedPrivateTest",
    "PRIVATE COMBINED LEARNER",
    f.learnerId,
  ])
    expect(html).not.toContain(value);
  await access(f.staff, f.parent, 1, "active");
  await world.owner.pool.query(
    "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1 AND learner_id=$2",
    [f.parent.id, f.learnerId],
  );
  await expect(
    readPrivateMeetingLink(world.runtime, f.parent.headers, f.bookingId),
  ).rejects.toMatchObject({ status: 404 });
  expect(
    (await readCase(world.runtime, f.parent.headers, f.caseId, "requester"))
      .booking,
  ).toEqual({ available: false });
  expect(
    (await readCase(world.runtime, f.staff.headers, f.caseId, "reviewer"))
      .booking,
  ).toEqual({ available: false });
  await expect(
    createCase(world.runtime, f.parent.headers, {
      ...f.report,
      requestKey: randomUUID(),
    }),
  ).rejects.toMatchObject({ status: 404 });
  const otherStaff = await createAccount(world, ["admin"]);
  await authorizeFixtureReviewer(world.owner, otherStaff.id);
  await assignFixtureCase(world.owner, f.caseId, otherStaff.id);
  await expect(
    readCase(world.runtime, f.staff.headers, f.caseId, "reviewer"),
  ).rejects.toMatchObject({ status: 404 });
  expect(
    (await readCase(world.runtime, otherStaff.headers, f.caseId, "reviewer"))
      .booking,
  ).toEqual({ available: false });
}, 60000);
it("tutor suspension blocks link/profile/password; restore preserves rejected review and elapsed link TTL without rewriting history", async () => {
  const f = await fixture();
  await access(f.staff, f.tutor, 0, "suspended");
  await expect(
    savePrivateMeetingLink(world.runtime, f.tutor.headers, f.bookingId, {
      url: privateUrl,
      expectedRevision: 1,
      requestId: randomUUID(),
    }),
  ).rejects.toMatchObject({ status: 404 });
  expect(
    (
      await handleTutorProfileRequest(
        world.runtime,
        jsonRequest(world, "/api/tutor/profile", {
          method: "PUT",
          cookie: f.tutor.cookie,
          body: {},
        }),
      )
    ).status,
  ).toBe(403);
  expect((await rotate(f.tutor)).status).toBe(403);
  await world.owner.pool.query(
    "UPDATE tutor_profiles SET review_status='rejected' WHERE id=$1",
    [f.profileId],
  );
  await access(f.staff, f.tutor, 1, "active");
  expect(
    (
      await world.owner.pool.query(
        "SELECT review_status FROM tutor_profiles WHERE id=$1",
        [f.profileId],
      )
    ).rows[0].review_status,
  ).toBe("rejected");
  await expect(
    readPrivateMeetingLink(world.runtime, f.parent.headers, f.bookingId),
  ).rejects.toMatchObject({ status: 404 });
  await world.owner.pool.query(
    "UPDATE tutor_profiles SET review_status='approved' WHERE id=$1",
    [f.profileId],
  );
  const shortId = await familyReservation(world.owner.pool, {
    actorId: f.parent.id,
    learnerId: f.learnerId,
    tutorId: f.profileId,
    startMinutes: 360,
    expiresInSeconds: 2,
  });
  await savePrivateMeetingLink(world.runtime, f.tutor.headers, shortId, {
    url: privateUrl,
    expectedRevision: 0,
    requestId: randomUUID(),
  });
  const before = await facts(shortId);
  await access(f.staff, f.parent, 0, "suspended");
  await new Promise((r) => setTimeout(r, 2100));
  await access(f.staff, f.parent, 1, "active");
  expect(
    await readPrivateMeetingLink(world.runtime, f.parent.headers, shortId),
  ).toEqual({ state: "expired" });
  expect(await facts(shortId)).toEqual(before);
  expect(
    (
      await world.owner.pool.query(
        "SELECT count(*)::int AS n FROM booking_meeting_links WHERE booking_id=$1",
        [shortId],
      )
    ).rows[0].n,
  ).toBe(1);
}, 60000);
