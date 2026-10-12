import { randomUUID } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
import {
  bookings,
  bookingEvents,
  guardianLearnerLinks,
  learnerProfiles,
  subjects,
  tutorAvailability,
  tutorProfiles,
  tutorSubjects,
  user,
  userAccess,
  userRoles,
} from "@/lib/db/schema";
import { dispatchPendingBookingNotices } from "@/features/booking-notifications/dispatch";
import * as capture from "@/features/booking-notifications/local-capture";
import { readSimulationNoticeRecipient } from "@/features/bookings/read-notice";
import {
  createDemoReservation,
  readDemoCandidates,
} from "@/features/bookings/service";
import { closeWorld, createAccount, openWorld, type World } from "./support";

let world: World, subjectId: string;
beforeAll(async () => {
  world = openWorld();
  const [subject] = await world.owner.db
    .select({ id: subjects.id })
    .from(subjects)
    .where(eq(subjects.slug, "math"));
  subjectId = subject.id;
});
const changedEmails = new Map<string, string>();
async function rememberSyntheticEmail(id: string) {
  const row = (
    await world.owner.pool.query('SELECT email FROM "user" WHERE id=$1', [id])
  ).rows[0];
  if (!row?.email.endsWith(".test"))
    throw new Error(
      "Owned synthetic email required before negative fixture mutation.",
    );
  changedEmails.set(id, row.email);
}
afterEach(async () => {
  try {
    for (const [id, email] of changedEmails)
      await world.owner.pool.query('UPDATE "user" SET email=$2 WHERE id=$1', [
        id,
        email,
      ]);
  } finally {
    changedEmails.clear();
    vi.restoreAllMocks();
  }
});
afterAll(() => closeWorld(world));

async function identity(
  roles: ("parent" | "student" | "tutor" | "admin")[],
  timezone = "UTC",
) {
  const id = randomUUID();
  await world.owner.db.insert(user).values({
    id,
    name: "Synthetic notice account",
    email: `notice-${id}@learli.test`,
    emailVerified: true,
    timezone,
  });
  await world.owner.db.insert(userAccess).values({ userId: id });
  await world.owner.db
    .insert(userRoles)
    .values(roles.map((role) => ({ userId: id, role })));
  return id;
}
async function fixture(
  options: {
    self?: boolean;
    dual?: boolean;
    expired?: boolean;
    actorId?: string;
  } = {},
) {
  const creatorId =
    options.actorId ??
    (await identity(
      options.self
        ? ["student"]
        : options.dual
          ? ["parent", "tutor"]
          : ["parent"],
      "America/New_York",
    ));
  const tutorUserId = options.dual
    ? creatorId
    : await identity(["tutor"], "Europe/Paris");
  const [learner] = await world.owner.db
    .insert(learnerProfiles)
    .values({
      fixtureKey: randomUUID(),
      source: "local_fixture",
      management: options.self ? "self" : "guardian",
      userId: options.self ? creatorId : null,
      displayName: "Private synthetic notice learner",
      level: options.self ? "college_support" : "elementary",
      timezone: "Australia/Brisbane",
    })
    .returning();
  if (!options.self)
    await world.owner.db.insert(guardianLearnerLinks).values({
      guardianUserId: creatorId,
      learnerId: learner.id,
      source: "local_fixture",
      status: "authorized",
    });
  const [profile] = await world.owner.db
    .insert(tutorProfiles)
    .values({
      userId: tutorUserId,
      slug: `notice-${randomUUID()}`,
      headline: "Synthetic notice tutor",
      bio: "Local fixture only.",
      teachingBackground: "Synthetic local teaching.",
      timezone: "Asia/Manila",
      reviewStatus: "approved",
    })
    .returning();
  await world.owner.db.insert(tutorSubjects).values({
    tutorId: profile.id,
    subjectId,
    levels: ["elementary", "college_support"],
  });
  const now = new Date();
  const createdAt = options.expired ? new Date(now.getTime() - 120_000) : now;
  const expiresAt = new Date(
    createdAt.getTime() + (options.expired ? 60_000 : 600_000),
  );
  const values = {
    id: randomUUID(),
    source: "local_simulation" as const,
    tutorId: profile.id,
    learnerId: learner.id,
    bookedByUserId: creatorId,
    subjectId,
    startAtUtc: new Date(now.getTime() + 86_400_000),
    endAtUtc: new Date(now.getTime() + 90_000_000),
    displayTimezone: "America/New_York",
    state: "demo_reserved" as const,
    createdAt,
    expiresAt,
    idempotencyKey: randomUUID(),
    requestFingerprint: "a".repeat(64),
  };
  const eventId = randomUUID();
  return { creatorId, tutorUserId, learner, profile, values, eventId };
}
async function commit(data: Awaited<ReturnType<typeof fixture>>) {
  await world.runtime.db.transaction(async (tx) => {
    await tx.insert(bookings).values(data.values);
    await tx.insert(bookingEvents).values({
      id: data.eventId,
      bookingId: data.values.id,
      event: "demo_reserved",
      createdAt: data.values.createdAt,
    });
  });
  return data;
}
async function rows(eventId: string) {
  return (
    await world.owner.pool.query(
      "SELECT recipient_user_id, state, attempts, failure_code, suppressed_reason FROM booking_notification_deliveries WHERE event_id=$1 ORDER BY recipient_user_id",
      [eventId],
    )
  ).rows as {
    recipient_user_id: string;
    state: string;
    attempts: number;
    failure_code: string | null;
    suppressed_reason: string | null;
  }[];
}
const dispatch = (eventId: string, limit = 25) =>
  dispatchPendingBookingNotices(world.runtime, { eventId, limit });
const file = (
  data: Awaited<ReturnType<typeof fixture>>,
  recipient = data.creatorId,
) =>
  path.join(
    capture.bookingNoticeMailbox("test"),
    `${capture.bookingNoticeKey(data.eventId, recipient)}.html`,
  );

describe("committed local reservation notice capture against PostgreSQL", () => {
  it("queues the actual service creation event once across identical booking retries", async () => {
    await world.owner.pool.query("UPDATE rate_limit SET count=0");
    const account = await createAccount(world, ["parent"]);
    const data = await fixture({ actorId: account.id });
    await world.owner.db.insert(tutorAvailability).values(
      Array.from({ length: 7 }, (_, i) => ({
        tutorId: data.profile.id,
        isoWeekday: i + 1,
        startMinute: 0,
        endMinute: 1440,
      })),
    );
    const choice = {
      learnerId: data.learner.id,
      tutorSlug: data.profile.slug,
      subjectSlug: "math",
      displayTimezone: "Asia/Manila",
    };
    const candidates = await readDemoCandidates(
      world.runtime,
      account.headers,
      choice,
    );
    const input = {
      ...choice,
      startAtUtc: candidates.times[0].startAtUtc,
      endAtUtc: candidates.times[0].endAtUtc,
      idempotencyKey: randomUUID(),
    };
    const first = await createDemoReservation(
      world.runtime,
      account.headers,
      input,
    );
    const retry = await createDemoReservation(
      world.runtime,
      account.headers,
      input,
    );
    expect(first.id).toBe(retry.id);
    const events = await world.owner.db
      .select()
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, first.id));
    expect(events).toHaveLength(1);
    expect(await rows(events[0].id)).toHaveLength(2);
    expect(await dispatch(events[0].id)).toMatchObject({
      captured: 2,
      retryable: 0,
    });
  });

  it("captures creator and assigned tutor with their own zones and no private learner/contact fields", async () => {
    const data = await commit(await fixture());
    expect(await dispatch(data.eventId)).toEqual({
      captured: 2,
      suppressed: 0,
      retryable: 0,
      skipped: 0,
    });
    const creatorHtml = await readFile(file(data), "utf8");
    const tutorHtml = await readFile(file(data, data.tutorUserId), "utf8");
    expect(creatorHtml).toContain("Eastern Time");
    expect(tutorHtml).toContain("Central European Time");
    expect(tutorHtml).not.toContain("Eastern Time");
    for (const html of [creatorHtml, tutorHtml]) {
      // Boolean assertions prevent a failed privacy test from printing private values.
      for (const value of [
        data.learner.displayName,
        data.learner.id,
        data.creatorId,
        data.tutorUserId,
        "@learli.test",
        "Australia/Brisbane",
      ])
        expect(html.includes(value)).toBe(false);
      expect(html).toContain("Local capture only. No email was sent.");
      expect(html).toContain("This is not a confirmed lesson.");
    }
    expect((await stat(file(data))).mode & 0o777).toBe(0o600);
    expect(
      (await stat(capture.bookingNoticeMailbox("test"))).mode & 0o777,
    ).toBe(0o700);
  });

  it("supports eligible self learners without a guardian recipient", async () => {
    const data = await commit(await fixture({ self: true }));
    expect(await dispatch(data.eventId)).toMatchObject({ captured: 2 });
    expect(await readFile(file(data), "utf8")).toContain("?scope=student");
  });

  it("deduplicates an account filling creator and tutor roles without combined private payloads", async () => {
    const data = await commit(await fixture({ dual: true }));
    expect(await rows(data.eventId)).toHaveLength(1);
    expect(await dispatch(data.eventId)).toMatchObject({ captured: 1 });
    expect(await dispatch(data.eventId)).toMatchObject({ captured: 0 });
    expect(
      (await readdir(capture.bookingNoticeMailbox("test"))).filter((name) =>
        name.startsWith(capture.bookingNoticeKey(data.eventId, data.creatorId)),
      ),
    ).toHaveLength(1);
  });

  it("never captures an uncommitted outer creation or its eventual rollback", async () => {
    const data = await fixture();
    const sentinel = new Error("Controlled synthetic rollback");
    await expect(
      world.runtime.db.transaction(async (tx) => {
        await tx.insert(bookings).values(data.values);
        await tx.insert(bookingEvents).values({
          id: data.eventId,
          bookingId: data.values.id,
          event: "demo_reserved",
        });
        expect(await dispatch(data.eventId)).toEqual({
          captured: 0,
          suppressed: 0,
          retryable: 0,
          skipped: 0,
        });
        throw sentinel;
      }),
    ).rejects.toBe(sentinel);
    expect(await rows(data.eventId)).toHaveLength(0);
    await expect(access(file(data))).rejects.toMatchObject({ code: "ENOENT" });
    expect(
      await world.owner.db
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.id, data.values.id)),
    ).toHaveLength(0);
  });

  it("keeps committed booking/event intact when capture fails and retries safely", async () => {
    const data = await commit(await fixture());
    const failed = vi
      .spyOn(capture, "captureBookingNotice")
      .mockRejectedValue(
        new Error("Do not log synthetic private failure details"),
      );
    expect(await dispatch(data.eventId)).toMatchObject({
      captured: 0,
      retryable: 2,
    });
    expect(await rows(data.eventId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          state: "pending",
          attempts: 1,
          failure_code: "capture_unavailable",
        }),
      ]),
    );
    const [booking] = await world.owner.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, data.values.id));
    expect(booking.state).toBe("demo_reserved");
    expect(
      await world.owner.db
        .select()
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, booking.id)),
    ).toHaveLength(1);
    failed.mockRestore();
    expect(await dispatch(data.eventId)).toMatchObject({
      captured: 2,
      retryable: 0,
    });
    expect(
      (await rows(data.eventId)).every(
        (row) =>
          row.state === "captured" &&
          row.attempts === 2 &&
          row.failure_code === null,
      ),
    ).toBe(true);
    expect(await dispatch(data.eventId)).toMatchObject({ captured: 0 });
  });

  it("reuses one atomic artifact after capture succeeds but database acknowledgement fails", async () => {
    const data = await commit(await fixture({ dual: true }));
    await world.owner.pool.query(
      `CREATE FUNCTION notice_test_ack_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_id='${data.eventId}' AND NEW.state='captured' THEN RAISE EXCEPTION 'Controlled ack failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER notice_test_ack_failure BEFORE UPDATE ON booking_notification_deliveries FOR EACH ROW EXECUTE FUNCTION notice_test_ack_failure()`,
    );
    try {
      expect(await dispatch(data.eventId)).toMatchObject({
        captured: 0,
        retryable: 1,
      });
      await access(file(data));
      expect((await rows(data.eventId))[0].state).toBe("pending");
    } finally {
      await world.owner.pool.query(
        "DROP TRIGGER notice_test_ack_failure ON booking_notification_deliveries; DROP FUNCTION notice_test_ack_failure()",
      );
    }
    expect(await dispatch(data.eventId)).toMatchObject({ captured: 1 });
    expect(
      (await readdir(capture.bookingNoticeMailbox("test"))).filter((name) =>
        name.startsWith(capture.bookingNoticeKey(data.eventId, data.creatorId)),
      ),
    ).toHaveLength(1);
  });

  it("deduplicates concurrent manual invocations using real PostgreSQL claims", async () => {
    const data = await commit(await fixture());
    const spy = vi.spyOn(capture, "captureBookingNotice");
    const results = await Promise.all([
      dispatch(data.eventId),
      dispatch(data.eventId),
      dispatch(data.eventId),
    ]);
    expect(results.reduce((sum, result) => sum + result.captured, 0)).toBe(2);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(
      (await rows(data.eventId)).every(
        (row) => row.state === "captured" && row.attempts === 1,
      ),
    ).toBe(true);
  });

  it("bounds one invocation and permits a later targeted drain", async () => {
    const data = await commit(await fixture());
    expect(await dispatch(data.eventId, 1)).toMatchObject({ captured: 1 });
    expect(
      (await rows(data.eventId)).filter((row) => row.state === "pending"),
    ).toHaveLength(1);
    expect(await dispatch(data.eventId, 1)).toMatchObject({ captured: 1 });
  });

  it("rechecks recipient authorization after earlier captures within the same invocation", async () => {
    const data = await commit(await fixture());
    const recipients = (await rows(data.eventId)).map(
      (row) => row.recipient_user_id,
    );
    const originalCapture = capture.captureBookingNotice;
    let signal: () => void = () => {};
    let resume: () => void = () => {};
    const entered = new Promise<void>((resolve) => {
      signal = resolve;
    });
    const held = new Promise<void>((resolve) => {
      resume = resolve;
    });
    vi.spyOn(capture, "captureBookingNotice").mockImplementation(
      async (options) => {
        if (options.recipientUserId === recipients[0]) {
          signal();
          await held;
        }
        return originalCapture(options);
      },
    );
    const pending = dispatch(data.eventId);
    await entered;
    await world.owner.db
      .update(userAccess)
      .set({ status: "suspended" })
      .where(eq(userAccess.userId, recipients[1]));
    resume();
    expect(await pending).toMatchObject({ captured: 1, suppressed: 1 });
    expect(
      (await rows(data.eventId)).find(
        (row) => row.recipient_user_id === recipients[1],
      )?.state,
    ).toBe("suppressed");
  });

  it("suppresses elapsed reservations and queues no expiry notice", async () => {
    const data = await commit(await fixture({ expired: true }));
    await world.runtime.db
      .update(bookings)
      .set({ state: "demo_expired" })
      .where(eq(bookings.id, data.values.id));
    await world.runtime.db
      .insert(bookingEvents)
      .values({ bookingId: data.values.id, event: "demo_expired" });
    expect(await rows(data.eventId)).toHaveLength(2);
    expect(await dispatch(data.eventId)).toMatchObject({
      captured: 0,
      suppressed: 2,
    });
    await expect(access(file(data))).rejects.toMatchObject({ code: "ENOENT" });
    expect(
      (await rows(data.eventId)).every(
        (row) => row.suppressed_reason === "outdated_or_unauthorized",
      ),
    ).toBe(true);
  });

  it.each([
    "suspended",
    "unverified",
    "role-revoked",
    "guardian-revoked",
    "self-role-revoked",
    "real-email",
  ])("suppresses currently unauthorized creator: %s", async (condition) => {
    const data = await commit(
      await fixture({ self: condition === "self-role-revoked" }),
    );
    if (condition === "suspended")
      await world.owner.db
        .update(userAccess)
        .set({ status: "suspended" })
        .where(eq(userAccess.userId, data.creatorId));
    if (condition === "unverified")
      await world.owner.db
        .update(user)
        .set({ emailVerified: false })
        .where(eq(user.id, data.creatorId));
    if (condition.includes("role-revoked"))
      await world.owner.db
        .delete(userRoles)
        .where(eq(userRoles.userId, data.creatorId));
    if (condition === "guardian-revoked")
      await world.owner.db
        .update(guardianLearnerLinks)
        .set({ status: "revoked" })
        .where(eq(guardianLearnerLinks.learnerId, data.learner.id));
    if (condition === "real-email") {
      await rememberSyntheticEmail(data.creatorId);
      await world.owner.db
        .update(user)
        .set({ email: `synthetic-${randomUUID()}@example.com` })
        .where(eq(user.id, data.creatorId));
    }
    await dispatch(data.eventId);
    expect(
      (await rows(data.eventId)).find(
        (row) => row.recipient_user_id === data.creatorId,
      )?.state,
    ).toBe("suppressed");
    await expect(access(file(data))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([
    "role-revoked",
    "suspended",
    "unverified",
    "review-suspended",
    "review-pending",
    "review-rejected",
    "reassigned",
  ])(
    "suppresses currently unauthorized assigned tutor: %s",
    async (condition) => {
      const data = await commit(await fixture());
      if (condition === "role-revoked")
        await world.owner.db
          .delete(userRoles)
          .where(eq(userRoles.userId, data.tutorUserId));
      if (condition === "suspended")
        await world.owner.db
          .update(userAccess)
          .set({ status: "suspended" })
          .where(eq(userAccess.userId, data.tutorUserId));
      if (condition === "unverified")
        await world.owner.db
          .update(user)
          .set({ emailVerified: false })
          .where(eq(user.id, data.tutorUserId));
      if (condition === "review-suspended")
        await world.owner.db
          .update(tutorProfiles)
          .set({ reviewStatus: "suspended" })
          .where(eq(tutorProfiles.id, data.profile.id));
      if (condition === "review-pending" || condition === "review-rejected")
        await world.owner.db
          .update(tutorProfiles)
          .set({
            reviewStatus:
              condition === "review-pending" ? "pending" : "rejected",
          })
          .where(eq(tutorProfiles.id, data.profile.id));
      if (condition === "reassigned")
        await world.owner.db
          .update(tutorProfiles)
          .set({ userId: await identity(["tutor"]) })
          .where(eq(tutorProfiles.id, data.profile.id));
      await dispatch(data.eventId);
      expect(
        (await rows(data.eventId)).find(
          (row) => row.recipient_user_id === data.tutorUserId,
        )?.state,
      ).toBe("suppressed");
      await expect(access(file(data, data.tutorUserId))).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
  );

  it("does not notify other linked guardians, unrelated accounts or blanket admins", async () => {
    const data = await commit(await fixture());
    const guardian = await identity(["parent"]),
      admin = await identity(["admin"]);
    await world.owner.db.insert(guardianLearnerLinks).values({
      guardianUserId: guardian,
      learnerId: data.learner.id,
      source: "local_fixture",
      status: "authorized",
    });
    for (const recipientUserId of [guardian, admin, randomUUID()])
      expect(
        await readSimulationNoticeRecipient(world.runtime.db, {
          bookingId: data.values.id,
          eventId: data.eventId,
          recipientUserId,
        }),
      ).toBeNull();
    expect(await rows(data.eventId)).toHaveLength(2);
  });

  it("denies runtime arbitrary insertion/deletion/identity edits and terminal rewrites", async () => {
    const data = await commit(await fixture({ dual: true }));
    await expect(
      world.runtime.pool.query(
        "DELETE FROM booking_notification_deliveries WHERE event_id=$1",
        [data.eventId],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      world.runtime.pool.query(
        "UPDATE booking_notification_deliveries SET recipient_user_id=$1 WHERE event_id=$2",
        [data.tutorUserId, data.eventId],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      world.runtime.pool.query(
        "INSERT INTO booking_notification_deliveries(event_id,recipient_user_id,kind) VALUES($1,$2,'simulated_reservation_created')",
        [data.eventId, data.creatorId],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      world.runtime.pool.query(
        "UPDATE booking_events SET event='demo_expired' WHERE id=$1",
        [data.eventId],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      world.runtime.pool.query("DELETE FROM booking_events WHERE id=$1", [
        data.eventId,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await dispatch(data.eventId);
    await expect(
      world.runtime.pool.query(
        "UPDATE booking_notification_deliveries SET attempts=attempts+1 WHERE event_id=$1",
        [data.eventId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("rejects nullable forged suppression shapes and immutable identity changes", async () => {
    const data = await commit(await fixture({ dual: true }));
    await expect(
      world.owner.pool.query(
        "UPDATE booking_notification_deliveries SET state='suppressed',attempts=attempts+1,last_attempt_at=clock_timestamp(),closed_at=clock_timestamp(),suppressed_reason=NULL WHERE event_id=$1",
        [data.eventId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      world.owner.pool.query(
        "UPDATE booking_notification_deliveries SET kind='other',attempts=attempts+1 WHERE event_id=$1",
        [data.eventId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    expect((await rows(data.eventId))[0].state).toBe("pending");
  });

  it("refuses malformed/unbounded/manual remote or wrong-environment invocation", async () => {
    const data = await commit(await fixture());
    for (const limit of [0, -1, 26, 1.5])
      await expect(dispatch(data.eventId, limit)).rejects.toThrow();
    await expect(
      dispatchPendingBookingNotices(world.runtime, { eventId: "bad" }),
    ).rejects.toThrow();
    await expect(
      dispatchPendingBookingNotices(
        { ...world.runtime, origin: "https://example.com" },
        { eventId: data.eventId },
      ),
    ).rejects.toThrow();
    await expect(
      dispatchPendingBookingNotices(
        { ...world.runtime, environment: "development" },
        { eventId: data.eventId },
      ),
    ).rejects.toThrow();
    await expect(
      dispatchPendingBookingNotices(
        { ...world.runtime, pool: world.owner.pool },
        { eventId: data.eventId },
      ),
    ).rejects.toThrow();
    expect((await rows(data.eventId)).every((row) => row.attempts === 0)).toBe(
      true,
    );
  });
});
