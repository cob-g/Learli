import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  bookings,
  bookingEvents,
  guardianLearnerLinks,
  learnerProfiles,
  subjects,
  tutorProfiles,
  user,
  userAccess,
  userRoles,
  session,
} from "@/lib/db/schema";
import {
  listParticipantBookings,
  listParticipantBookingOverview,
  readParticipantBooking,
} from "@/features/bookings/read-service";
import { handleBookingRead } from "@/features/bookings/read-handler";
import { readDemoCandidates } from "@/features/bookings/service";
import { readSimulationNoticeRecipient } from "@/features/bookings/read-notice";
import {
  openWorld,
  closeWorld,
  createAccount,
  jsonRequest,
  type World,
  type TestAccount,
} from "./support";

let world: World;
let parent: TestAccount,
  secondGuardian: TestAccount,
  other: TestAccount,
  self: TestAccount,
  tutor: TestAccount,
  otherTutor: TestAccount,
  admin: TestAccount;
let learnerId: string,
  selfId: string,
  profileId: string,
  subjectId: string,
  slug: string;
let fixtureIndex = 0;
async function fixtureLearner(actor: TestAccount, independent = false) {
  const [row] = await world.owner.db
    .insert(learnerProfiles)
    .values({
      fixtureKey: randomUUID(),
      source: "local_fixture",
      management: independent ? "self" : "guardian",
      userId: independent ? actor.id : null,
      displayName: "Synthetic private read learner",
      level: independent ? "college_support" : "elementary",
      timezone: "Pacific/Auckland",
    })
    .returning();
  if (!independent)
    await world.owner.db.insert(guardianLearnerLinks).values({
      guardianUserId: actor.id,
      learnerId: row.id,
      source: "local_fixture",
      status: "authorized",
    });
  return row.id;
}
async function storedBooking({
  learner = learnerId,
  expired = false,
  materialized = false,
  start = new Date(Date.now() + (10 + fixtureIndex++) * 86400000),
  assignedTutor = profileId,
  id = randomUUID(),
  booker,
}: {
  learner?: string;
  expired?: boolean;
  materialized?: boolean;
  start?: Date;
  assignedTutor?: string;
  id?: string;
  booker?: string;
} = {}) {
  const createdAt = new Date(Date.now() - (expired ? 1200000 : 60000));
  const [row] = await world.owner.db
    .insert(bookings)
    .values({
      id,
      source: "local_simulation",
      tutorId: assignedTutor,
      learnerId: learner,
      bookedByUserId: booker ?? (learner === selfId ? self.id : parent.id),
      subjectId,
      startAtUtc: start,
      endAtUtc: new Date(start.getTime() + 3600000),
      displayTimezone: "Pacific/Auckland",
      state: materialized ? "demo_expired" : "demo_reserved",
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 600000),
      idempotencyKey: randomUUID(),
      requestFingerprint: "a".repeat(64),
    })
    .returning();
  await world.owner.db
    .insert(bookingEvents)
    .values({ bookingId: row.id, event: "demo_reserved", createdAt });
  if (materialized)
    await world.owner.db.insert(bookingEvents).values({
      bookingId: row.id,
      event: "demo_expired",
      createdAt: new Date(),
    });
  return row;
}
beforeAll(async () => {
  world = openWorld();
  await world.owner.pool.query("UPDATE rate_limit SET count=0");
  parent = await createAccount(world, ["parent"]);
  secondGuardian = await createAccount(world, ["parent"]);
  other = await createAccount(world, ["parent"]);
  self = await createAccount(world, ["student"]);
  tutor = await createAccount(world, ["tutor"]);
  otherTutor = await createAccount(world, ["tutor"]);
  admin = await createAccount(world, ["admin"]);
  learnerId = await fixtureLearner(parent);
  selfId = await fixtureLearner(self, true);
  await world.owner.db.insert(guardianLearnerLinks).values({
    guardianUserId: secondGuardian.id,
    learnerId,
    source: "local_fixture",
    status: "authorized",
  });
  const [subject] = await world.owner.db
    .select()
    .from(subjects)
    .where(eq(subjects.slug, "math"));
  subjectId = subject.id;
  slug = `history-${randomUUID()}`;
  const [profile] = await world.owner.db
    .insert(tutorProfiles)
    .values({
      userId: tutor.id,
      slug,
      headline: "Synthetic tutor",
      bio: "Synthetic only.",
      teachingBackground: "Synthetic fixture.",
      timezone: "Asia/Manila",
      reviewStatus: "approved",
    })
    .returning();
  profileId = profile.id;
  await world.owner.db
    .update(user)
    .set({ timezone: "America/New_York" })
    .where(eq(user.id, parent.id));
  await world.owner.db
    .update(user)
    .set({ timezone: "Asia/Manila" })
    .where(eq(user.id, tutor.id));
}, 60000);
afterAll(() => closeWorld(world));

describe("real PostgreSQL participant reads", () => {
  it("overview has one snapshot, current zone/learners and separately bounded ordered active/history pages", async () => {
    const learner = await fixtureLearner(parent);
    const start = Date.now() + 7 * 86400000;
    const active = [],
      history = [];
    for (let i = 0; i < 3; i++) {
      active.push(
        await storedBooking({ learner, start: new Date(start + i * 3600000) }),
      );
      history.push(
        await storedBooking({
          learner,
          expired: true,
          start: new Date(start + (i + 4) * 3600000),
        }),
      );
    }
    const query = vi.spyOn(world.runtime.db, "execute");
    const overview = await listParticipantBookingOverview(
      world.runtime,
      parent.headers,
      { scope: "guardian", learnerId: learner, pageSize: 2, page: 2 },
    );
    expect(query).toHaveBeenCalledTimes(1);
    query.mockRestore();
    expect(overview.active.items.map((b) => b.id)).toEqual(
      active.slice(0, 2).map((b) => b.id),
    );
    expect(overview.active.page).toBe(1);
    expect(overview.active.hasNext).toBe(true);
    expect(overview.history.items.map((b) => b.id)).toEqual([history[0].id]);
    expect(overview.history.page).toBe(2);
    expect(overview.history.hasNext).toBe(false);
    expect(overview.active.snapshotAtUtc).toBe(overview.history.snapshotAtUtc);
    expect(overview.active.viewerTimezone).toBe(
      overview.history.viewerTimezone,
    );
    expect(overview.active.learners).toEqual(overview.history.learners);
    const now = Date.parse(overview.active.snapshotAtUtc);
    expect(
      overview.active.items.every(
        (b) => b.state === "demo_reserved" && Date.parse(b.expiresAtUtc) > now,
      ),
    ).toBe(true);
    expect(
      overview.history.items.every(
        (b) => b.state === "demo_expired" && Date.parse(b.expiresAtUtc) <= now,
      ),
    ).toBe(true);
    const empty = await listParticipantBookingOverview(
      world.runtime,
      other.headers,
      { scope: "guardian", learnerId: learner },
    );
    expect(empty.active.items).toEqual([]);
    expect(empty.history.items).toEqual([]);
    expect(empty.active.snapshotAtUtc).toBe(empty.history.snapshotAtUtc);
    await expect(
      listParticipantBookingOverview(world.runtime, parent.headers, {
        scope: "guardian",
        filter: "active",
      }),
    ).rejects.toThrow();
  });
  it("overview rechecks current viewer zone and revoked learner context after provider resolution waits", async () => {
    const learner = await fixtureLearner(parent);
    await storedBooking({ learner, expired: true });
    const current = await world.runtime.auth.api.getSession({
      headers: parent.headers,
    });
    if (!current) throw new Error("Expected test session.");
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const spy = vi
      .spyOn(world.runtime.auth.api, "getSession")
      .mockImplementationOnce(async () => {
        entered();
        await gate;
        return current;
      });
    const read = listParticipantBookingOverview(world.runtime, parent.headers, {
      scope: "guardian",
      learnerId: learner,
    });
    await started;
    await world.owner.db
      .update(user)
      .set({ timezone: "Asia/Manila" })
      .where(eq(user.id, parent.id));
    await world.owner.db
      .update(guardianLearnerLinks)
      .set({ status: "revoked" })
      .where(eq(guardianLearnerLinks.learnerId, learner));
    release();
    try {
      const result = await read;
      expect(result.active.viewerTimezone).toBe("Asia/Manila");
      expect(result.history.viewerTimezone).toBe("Asia/Manila");
      for (const page of [result.active, result.history]) {
        expect(page.items).toEqual([]);
        expect(page.learners.map((l) => l.id)).not.toContain(learner);
      }
    } finally {
      spy.mockRestore();
      await world.owner.db
        .update(user)
        .set({ timezone: "America/New_York" })
        .where(eq(user.id, parent.id));
    }
  });
  it("returns authorized learner summaries with empty booking pages and current snapshot", async () => {
    const empty = await fixtureLearner(other);
    const result = await listParticipantBookings(world.runtime, other.headers, {
      scope: "guardian",
      learnerId: empty,
    });
    expect(result.items).toEqual([]);
    expect(result.learners.map((learner) => learner.id)).toContain(empty);
    expect(result.learners.map((learner) => learner.id)).not.toContain(
      learnerId,
    );
    expect(result.viewerTimezone).toBe("UTC");
    expect(Number.isFinite(Date.parse(result.snapshotAtUtc))).toBe(true);
    expect(
      (
        await listParticipantBookings(world.runtime, tutor.headers, {
          scope: "tutor",
        })
      ).learners,
    ).toEqual([]);
    await world.owner.db
      .update(guardianLearnerLinks)
      .set({ status: "revoked" })
      .where(eq(guardianLearnerLinks.learnerId, empty));
    expect(
      (
        await listParticipantBookings(world.runtime, other.headers, {
          scope: "guardian",
        })
      ).learners,
    ).toEqual([]);
  });
  it("reads actual fields for guardian, currently linked second guardian and assigned tutor, omitting write identities", async () => {
    const row = await storedBooking();
    for (const [actor, scope] of [
      [parent, "guardian"],
      [secondGuardian, "guardian"],
      [tutor, "tutor"],
    ] as const) {
      const result = await readParticipantBooking(
        world.runtime,
        actor.headers,
        row.id,
        scope,
      );
      expect(result.learner).toEqual({
        id: learnerId,
        displayName: "Synthetic private read learner",
        level: "elementary",
      });
      expect(result.subject.name).toBe("Math");
      expect(result.tutor.displayName).toBe(tutor.name);
      expect(result.events.map((e) => e.event)).toEqual(["demo_reserved"]);
      for (const forbidden of [
        "email",
        "bookedByUserId",
        "sessionId",
        "requestFingerprint",
        "idempotencyKey",
        "token",
        "meetingUrl",
      ])
        expect(JSON.stringify(result)).not.toContain(forbidden);
    }
  });
  it("supports an eligible own college learner and denies wrong role paths", async () => {
    const row = await storedBooking({
      learner: selfId,
      start: new Date(Date.now() + 2 * 86400000),
    });
    expect(
      (
        await readParticipantBooking(
          world.runtime,
          self.headers,
          row.id,
          "student",
        )
      ).learner.id,
    ).toBe(selfId);
    await expect(
      readParticipantBooking(world.runtime, parent.headers, row.id, "guardian"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      readParticipantBooking(world.runtime, self.headers, row.id, "guardian"),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("denies foreign family/tutor/student/admin and missing/malformed IDs identically", async () => {
    const row = await storedBooking({ expired: true });
    for (const [actor, scope] of [
      [other, "guardian"],
      [otherTutor, "tutor"],
      [self, "student"],
      [admin, "guardian"],
    ] as const)
      for (const id of [row.id, randomUUID(), "malformed"])
        await expect(
          readParticipantBooking(world.runtime, actor.headers, id, scope),
        ).rejects.toMatchObject({ status: 404 });
    await expect(
      readParticipantBooking(world.runtime, new Headers(), row.id, "guardian"),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("projects elapsed TTL without persisting expiry or fabricating history", async () => {
    const row = await storedBooking({ expired: true });
    const before = await world.owner.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, row.id));
    const detail = await readParticipantBooking(
      world.runtime,
      parent.headers,
      row.id,
      "guardian",
    );
    expect(detail.state).toBe("demo_expired");
    expect(detail.persistedState).toBe("demo_reserved");
    expect(detail.expiryMaterialized).toBe(false);
    expect(detail.events.map((e) => e.event)).toEqual(["demo_reserved"]);
    expect(
      await world.owner.db
        .select()
        .from(bookings)
        .where(eq(bookings.id, row.id)),
    ).toEqual(before);
    expect(
      await world.owner.db
        .select()
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, row.id)),
    ).toHaveLength(1);
  });
  it("shows only real ordered events after existing tutor-first expiry materialization", async () => {
    const row = await storedBooking({ expired: true });
    // Existing candidate read takes tutor lock and materializes actual DB expiry.
    await world.owner.pool.query(
      "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) VALUES ($1,$2,ARRAY['elementary','college_support']) ON CONFLICT DO NOTHING",
      [profileId, subjectId],
    );
    await readDemoCandidates(world.runtime, parent.headers, {
      learnerId,
      tutorSlug: slug,
      subjectSlug: "math",
      displayTimezone: "UTC",
    });
    const detail = await readParticipantBooking(
      world.runtime,
      parent.headers,
      row.id,
      "guardian",
    );
    expect(detail.persistedState).toBe("demo_expired");
    expect(detail.expiryMaterialized).toBe(true);
    expect(detail.events.map((e) => e.event)).toEqual([
      "demo_reserved",
      "demo_expired",
    ]);
    expect(new Date(detail.events[1].occurredAtUtc).getTime()).toBeGreaterThan(
      new Date(detail.events[0].occurredAtUtc).getTime(),
    );
  });
  it("ignores booking/learner timezone and uses current viewer preference with DST offsets", async () => {
    // This fixed repeated-hour interval must never share a tutor with ordinary
    // explicit or relative fixture slots, regardless of the current run date.
    const dstTutor = await createAccount(world, ["tutor"]);
    await world.owner.db
      .update(user)
      .set({ timezone: "Asia/Manila" })
      .where(eq(user.id, dstTutor.id));
    const [dstProfile] = await world.owner.db
      .insert(tutorProfiles)
      .values({
        userId: dstTutor.id,
        slug: `dst-history-${randomUUID()}`,
        headline: "Synthetic DST tutor",
        bio: "Synthetic DST isolation fixture.",
        teachingBackground: "Synthetic fixture.",
        timezone: "Asia/Manila",
        reviewStatus: "approved",
      })
      .returning();
    const row = await storedBooking({
      assignedTutor: dstProfile.id,
      expired: true,
      start: new Date("2026-11-01T05:30Z"),
    });
    const parentDetail = await readParticipantBooking(
      world.runtime,
      parent.headers,
      row.id,
      "guardian",
    );
    expect(parentDetail.viewerTimezone).toBe("America/New_York");
    expect(parentDetail.time.time).toContain("GMT-4");
    expect(parentDetail.time.time).toContain("GMT-5");
    const tutorDetail = await readParticipantBooking(
      world.runtime,
      dstTutor.headers,
      row.id,
      "tutor",
    );
    await expect(
      readParticipantBooking(world.runtime, tutor.headers, row.id, "tutor"),
    ).rejects.toThrow();
    expect(tutorDetail.viewerTimezone).toBe("Asia/Manila");
    expect(tutorDetail.time.zone).toContain("GMT+8");
    expect(JSON.stringify(tutorDetail)).not.toContain("America/New_York");
    await world.owner.db
      .update(user)
      .set({ timezone: "UTC" })
      .where(eq(user.id, parent.id));
    expect(
      (
        await readParticipantBooking(
          world.runtime,
          parent.headers,
          row.id,
          "guardian",
        )
      ).viewerTimezone,
    ).toBe("UTC");
    await world.owner.db
      .update(user)
      .set({ timezone: "America/New_York" })
      .where(eq(user.id, parent.id));
  });
  it("paginates deterministically with effective-state filtering and no foreign rows", async () => {
    const own = await fixtureLearner(parent);
    const start = Date.now() + 5 * 86400000;
    const rows = [];
    for (let i = 0; i < 3; i++)
      rows.push(
        await storedBooking({
          learner: own,
          start: new Date(start + i * 3600000),
        }),
      );
    const expired = await storedBooking({
      learner: own,
      expired: true,
      start: new Date(start + 4 * 3600000),
    });
    const active = await listParticipantBookings(
      world.runtime,
      parent.headers,
      { scope: "guardian", learnerId: own, filter: "active", pageSize: 2 },
    );
    expect(active.items.map((b) => b.id)).toEqual(
      rows.slice(0, 2).map((b) => b.id),
    );
    expect(active.hasNext).toBe(true);
    const next = await listParticipantBookings(world.runtime, parent.headers, {
      scope: "guardian",
      learnerId: own,
      filter: "active",
      pageSize: 2,
      page: 2,
    });
    expect(next.items.map((b) => b.id)).toEqual([rows[2].id]);
    expect(next.hasNext).toBe(false);
    const history = await listParticipantBookings(
      world.runtime,
      parent.headers,
      { scope: "guardian", learnerId: own, filter: "history" },
    );
    expect(history.items.map((b) => b.id)).toEqual([expired.id]);
    expect(history.items[0].state).toBe("demo_expired");
    const foreign = await listParticipantBookings(
      world.runtime,
      other.headers,
      { scope: "guardian", learnerId: own },
    );
    expect(foreign.items).toEqual([]);
    const all = await listParticipantBookings(world.runtime, parent.headers, {
      scope: "guardian",
      learnerId: own,
    });
    expect(all.items.map((b) => b.id)).toEqual([
      expired.id,
      ...rows.reverse().map((b) => b.id),
    ]);
  });
  it("returns empty authorized pages and rejects forged/oversized input", async () => {
    expect(
      (
        await listParticipantBookings(world.runtime, other.headers, {
          scope: "guardian",
          page: 2,
        })
      ).items,
    ).toEqual([]);
    for (const input of [
      { scope: "admin" },
      { scope: "guardian", userId: parent.id },
      { scope: "guardian", pageSize: 51 },
      { scope: "tutor", learnerId },
    ])
      await expect(
        listParticipantBookings(world.runtime, parent.headers, input),
      ).rejects.toThrow();
  });
  it("does not wait for a tutor mutation lock or modify reservations/history", async () => {
    const row = await storedBooking({ expired: true });
    const connection = await world.owner.pool.connect();
    try {
      await connection.query("BEGIN");
      await connection.query(
        "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
        [profileId],
      );
      const detail = await readParticipantBooking(
        world.runtime,
        parent.headers,
        row.id,
        "guardian",
      );
      expect(detail.state).toBe("demo_expired");
      expect(detail.events).toHaveLength(1);
    } finally {
      await connection.query("ROLLBACK");
      connection.release();
    }
  });
  it("keeps runtime booking history append-only while allowing actual minimal event SELECT", async () => {
    const row = await storedBooking({ expired: true });
    expect(
      await world.runtime.db
        .select()
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, row.id)),
    ).toHaveLength(1);
    for (const command of [
      "UPDATE booking_events SET event='demo_expired' WHERE booking_id=$1",
      "DELETE FROM booking_events WHERE booking_id=$1",
    ])
      await expect(
        world.runtime.pool.query(command, [row.id]),
      ).rejects.toMatchObject({ code: "42501" });
    expect(
      await world.owner.db
        .select()
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, row.id)),
    ).toHaveLength(1);
  });
  it("resolves creation-notice recipients on the passed transaction, not another guardian or arbitrary user", async () => {
    const row = await storedBooking();
    const [event] = await world.owner.db
      .select()
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, row.id));
    const input = {
      bookingId: row.id,
      eventId: event.id,
      recipientUserId: parent.id,
    };
    const result = await world.runtime.db.transaction((tx) =>
      readSimulationNoticeRecipient(tx, input),
    );
    expect(result?.scope).toBe("guardian");
    expect(result?.detailPath).toBe(`/bookings/${row.id}?scope=guardian`);
    expect(result?.viewerTimezone).toBe("America/New_York");
    expect(result?.recipientEmail === parent.email).toBe(true);
    expect(result && Object.keys(result)).not.toContain("learner");
    const assigned = await readSimulationNoticeRecipient(world.runtime.db, {
      ...input,
      recipientUserId: tutor.id,
    });
    expect(assigned?.scope).toBe("tutor");
    expect(assigned?.viewerTimezone).toBe("Asia/Manila");
    for (const recipientUserId of [
      secondGuardian.id,
      other.id,
      admin.id,
      randomUUID(),
    ])
      expect(
        await readSimulationNoticeRecipient(world.runtime.db, {
          ...input,
          recipientUserId,
        }),
      ).toBeNull();
    expect(
      await readSimulationNoticeRecipient(world.runtime.db, {
        ...input,
        eventId: randomUUID(),
      }),
    ).toBeNull();
  });
  it("suppresses elapsed or persisted-expired creation notices and revoked creator relationships", async () => {
    for (const materialized of [false, true]) {
      const row = await storedBooking({ expired: true, materialized });
      const [event] = await world.owner.db
        .select()
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, row.id));
      expect(
        await readSimulationNoticeRecipient(world.runtime.db, {
          bookingId: row.id,
          eventId: event.id,
          recipientUserId: parent.id,
        }),
      ).toBeNull();
    }
    const row = await storedBooking();
    const [event] = await world.owner.db
      .select()
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, row.id));
    await world.owner.db
      .update(guardianLearnerLinks)
      .set({ status: "revoked" })
      .where(eq(guardianLearnerLinks.guardianUserId, parent.id));
    try {
      expect(
        await readSimulationNoticeRecipient(world.runtime.db, {
          bookingId: row.id,
          eventId: event.id,
          recipientUserId: parent.id,
        }),
      ).toBeNull();
    } finally {
      await world.owner.db
        .update(guardianLearnerLinks)
        .set({ status: "authorized" })
        .where(eq(guardianLearnerLinks.guardianUserId, parent.id));
    }
  });
  it.each(["pending", "rejected", "suspended"] as const)(
    "creation tutor notices require approval, while historical web scope is separately enforced: %s",
    async (reviewStatus) => {
      const row = await storedBooking();
      const [event] = await world.owner.db
        .select()
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, row.id));
      await world.owner.db
        .update(tutorProfiles)
        .set({ reviewStatus })
        .where(eq(tutorProfiles.id, profileId));
      try {
        expect(
          await readSimulationNoticeRecipient(world.runtime.db, {
            bookingId: row.id,
            eventId: event.id,
            recipientUserId: tutor.id,
          }),
        ).toBeNull();
        if (reviewStatus === "suspended")
          await expect(
            readParticipantBooking(
              world.runtime,
              tutor.headers,
              row.id,
              "tutor",
            ),
          ).rejects.toMatchObject({ status: 404 });
        else
          expect(
            (
              await readParticipantBooking(
                world.runtime,
                tutor.headers,
                row.id,
                "tutor",
              )
            ).id,
          ).toBe(row.id);
      } finally {
        await world.owner.db
          .update(tutorProfiles)
          .set({ reviewStatus: "approved" })
          .where(eq(tutorProfiles.id, profileId));
      }
    },
  );
  it("derives eligible self and deterministic creator-before-tutor scope without duplicate recipients", async () => {
    const own = await storedBooking({ learner: selfId });
    const [ownEvent] = await world.owner.db
      .select()
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, own.id));
    expect(
      (
        await readSimulationNoticeRecipient(world.runtime.db, {
          bookingId: own.id,
          eventId: ownEvent.id,
          recipientUserId: self.id,
        })
      )?.scope,
    ).toBe("student");
    await world.owner.db
      .insert(userRoles)
      .values({ userId: tutor.id, role: "parent" });
    await world.owner.db.insert(guardianLearnerLinks).values({
      guardianUserId: tutor.id,
      learnerId,
      source: "local_fixture",
      status: "authorized",
    });
    const row = await storedBooking({ booker: tutor.id });
    const [event] = await world.owner.db
      .select()
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, row.id));
    const input = {
      bookingId: row.id,
      eventId: event.id,
      recipientUserId: tutor.id,
    };
    try {
      expect(
        (await readSimulationNoticeRecipient(world.runtime.db, input))?.scope,
      ).toBe("guardian");
      await world.owner.db
        .update(guardianLearnerLinks)
        .set({ status: "revoked" })
        .where(eq(guardianLearnerLinks.guardianUserId, tutor.id));
      expect(
        (await readSimulationNoticeRecipient(world.runtime.db, input))?.scope,
      ).toBe("tutor");
    } finally {
      await world.owner.pool.query(
        "DELETE FROM user_roles WHERE user_id=$1 AND role='parent'",
        [tutor.id],
      );
    }
  });
  it("rechecks self role/ownership and assigned tutor relationship", async () => {
    const row = await storedBooking({ learner: selfId, expired: true });
    await world.owner.db.delete(userRoles).where(eq(userRoles.userId, self.id));
    await expect(
      readParticipantBooking(world.runtime, self.headers, row.id, "student"),
    ).rejects.toMatchObject({ status: 404 });
    await world.owner.db
      .insert(userRoles)
      .values({ userId: self.id, role: "student" });
    await expect(
      world.owner.db
        .update(learnerProfiles)
        .set({ userId: admin.id })
        .where(eq(learnerProfiles.id, selfId)),
    ).rejects.toMatchObject({ cause: { code: "42501" } });
    const [unchanged] = await world.owner.db
      .select({ userId: learnerProfiles.userId })
      .from(learnerProfiles)
      .where(eq(learnerProfiles.id, selfId));
    expect(unchanged.userId).toBe(self.id);
    const foreignSelf = await fixtureLearner(admin, true);
    const foreignBooking = await storedBooking({
      learner: foreignSelf,
      expired: true,
      booker: self.id,
    });
    await expect(
      readParticipantBooking(
        world.runtime,
        self.headers,
        foreignBooking.id,
        "student",
      ),
    ).rejects.toMatchObject({ status: 404 });
    await world.owner.db
      .update(tutorProfiles)
      .set({ userId: otherTutor.id })
      .where(eq(tutorProfiles.id, profileId));
    await expect(
      readParticipantBooking(world.runtime, tutor.headers, row.id, "tutor"),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await readParticipantBooking(
          world.runtime,
          otherTutor.headers,
          row.id,
          "tutor",
        )
      ).id,
    ).toBe(row.id);
    await world.owner.db
      .update(tutorProfiles)
      .set({ userId: tutor.id })
      .where(eq(tutorProfiles.id, profileId));
  });
  it.each([
    "guardian link",
    "parent role",
    "active account",
    "verified email",
    "session",
    "learner status",
    "tutor role",
    "tutor suspension",
  ])(
    "denies revocation committed while preliminary session resolution waits: %s",
    async (kind) => {
      const row = await storedBooking({ expired: true });
      const actor = kind.startsWith("tutor") ? tutor : parent;
      const scope = kind.startsWith("tutor") ? "tutor" : "guardian";
      const current = await world.runtime.auth.api.getSession({
        headers: actor.headers,
      });
      if (!current) throw new Error("Expected test session.");
      let release!: () => void, entered!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const spy = vi
        .spyOn(world.runtime.auth.api, "getSession")
        .mockImplementationOnce(async () => {
          entered();
          await gate;
          return current;
        });
      const read = readParticipantBooking(
        world.runtime,
        actor.headers,
        row.id,
        scope,
      );
      const observed = read.catch((error: unknown) => error);
      await started;
      let restore: () => Promise<unknown>;
      switch (kind) {
        case "guardian link":
          await world.owner.db
            .update(guardianLearnerLinks)
            .set({ status: "revoked" })
            .where(eq(guardianLearnerLinks.guardianUserId, parent.id));
          restore = () =>
            world.owner.db
              .update(guardianLearnerLinks)
              .set({ status: "authorized" })
              .where(eq(guardianLearnerLinks.guardianUserId, parent.id));
          break;
        case "parent role":
        case "tutor role":
          await world.owner.db
            .delete(userRoles)
            .where(eq(userRoles.userId, actor.id));
          restore = () =>
            world.owner.db.insert(userRoles).values({
              userId: actor.id,
              role: scope === "tutor" ? "tutor" : "parent",
            });
          break;
        case "active account":
          await world.owner.db
            .update(userAccess)
            .set({ status: "suspended" })
            .where(eq(userAccess.userId, actor.id));
          restore = () =>
            world.owner.db
              .update(userAccess)
              .set({ status: "active" })
              .where(eq(userAccess.userId, actor.id));
          break;
        case "verified email":
          await world.owner.db
            .update(user)
            .set({ emailVerified: false })
            .where(eq(user.id, actor.id));
          restore = () =>
            world.owner.db
              .update(user)
              .set({ emailVerified: true })
              .where(eq(user.id, actor.id));
          break;
        case "session":
          await world.owner.db
            .update(session)
            .set({ expiresAt: new Date(0) })
            .where(eq(session.id, current.session.id));
          restore = () =>
            world.owner.db
              .update(session)
              .set({ expiresAt: current.session.expiresAt })
              .where(eq(session.id, current.session.id));
          break;
        case "learner status":
          await world.owner.db
            .update(learnerProfiles)
            .set({ status: "inactive" })
            .where(eq(learnerProfiles.id, learnerId));
          restore = () =>
            world.owner.db
              .update(learnerProfiles)
              .set({ status: "active" })
              .where(eq(learnerProfiles.id, learnerId));
          break;
        default:
          await world.owner.db
            .update(tutorProfiles)
            .set({ reviewStatus: "suspended" })
            .where(eq(tutorProfiles.id, profileId));
          restore = () =>
            world.owner.db
              .update(tutorProfiles)
              .set({ reviewStatus: "approved" })
              .where(eq(tutorProfiles.id, profileId));
      }
      release();
      try {
        expect(await observed).toMatchObject({ status: 404 });
      } finally {
        spy.mockRestore();
        await restore();
      }
    },
  );
  it("protects JSON read boundary and denies missing/foreign details with identical bodies", async () => {
    const row = await storedBooking({ expired: true });
    const request = (query = "scope=guardian", cookie = parent.cookie) =>
      jsonRequest(world, `/api/bookings/${row.id}?${query}`, {
        method: "GET",
        cookie,
      });
    const good = await handleBookingRead(world.runtime, request(), row.id);
    expect(good.status).toBe(200);
    expect(good.headers.get("cache-control")).toContain("no-store");
    const foreign = await handleBookingRead(
      world.runtime,
      request("scope=guardian", other.cookie),
      row.id,
    );
    const missing = await handleBookingRead(
      world.runtime,
      request(),
      randomUUID(),
    );
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
    for (const query of [
      "scope=admin",
      "scope=guardian&userId=foo",
      "scope=guardian&scope=tutor",
    ])
      expect(
        (await handleBookingRead(world.runtime, request(query), row.id)).status,
      ).toBe(400);
    expect((await handleBookingRead(null, request(), row.id)).status).toBe(503);
    expect(
      (
        await handleBookingRead(
          world.runtime,
          new Request(`${world.runtime.origin}/api/bookings?scope=guardian`, {
            headers: { host: "foreign.test" },
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handleBookingRead(
          world.runtime,
          request("scope=guardian", ""),
          row.id,
        )
      ).status,
    ).toBe(401);
  });
});
