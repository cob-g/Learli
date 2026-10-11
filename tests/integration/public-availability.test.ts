import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { PoolClient } from "pg";
import {
  bookings,
  learnerProfiles,
  guardianLearnerLinks,
  subjects,
  tutorAvailability,
  tutorProfiles,
  user,
  userAccess,
  userRoles,
  tutorAvailabilityExceptions,
} from "@/lib/db/schema";
import { readPublicCandidates } from "@/features/public-availability/service";
import { handlePublicCandidateRead } from "@/features/public-availability/handler";
import {
  readDemoCandidates,
  createDemoReservation,
} from "@/features/bookings/service";
import { bookingFingerprint } from "@/features/bookings/request-fingerprint";
import { loadDemoBookingResume } from "@/features/bookings/resume";
import {
  closeWorld,
  createAccount,
  openWorld,
  type World,
  type TestAccount,
} from "./support";

let world: World, parent: TestAccount, other: TestAccount;
let learnerId: string, foreignId: string, subjectId: string;
async function addLearner(actor: TestAccount) {
  const [row] = await world.owner.db
    .insert(learnerProfiles)
    .values({
      fixtureKey: randomUUID(),
      source: "local_fixture",
      management: "guardian",
      displayName: "Private synthetic preview learner",
      level: "elementary",
      timezone: "Asia/Manila",
    })
    .returning();
  await world.owner.db.insert(guardianLearnerLinks).values({
    guardianUserId: actor.id,
    learnerId: row.id,
    source: "local_fixture",
    status: "authorized",
  });
  return row.id;
}
async function tutor(empty = false) {
  const id = randomUUID();
  await world.owner.db.insert(user).values({
    id,
    name: "Synthetic public availability tutor",
    email: `preview-${id}@learli.test`,
    emailVerified: true,
  });
  await world.owner.db.insert(userAccess).values({ userId: id });
  await world.owner.db.insert(userRoles).values({ userId: id, role: "tutor" });
  const [profile] = await world.owner.db
    .insert(tutorProfiles)
    .values({
      userId: id,
      slug: `preview-${randomUUID()}`,
      headline: "Synthetic academic support",
      bio: "Synthetic local fixture only.",
      teachingBackground: "Synthetic fixture only.",
      timezone: "UTC",
      reviewStatus: "approved",
    })
    .returning();
  await world.owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) VALUES ($1,$2,ARRAY['elementary','college_support'])",
    [profile.id, subjectId],
  );
  if (!empty)
    await world.owner.db.insert(tutorAvailability).values(
      Array.from({ length: 7 }, (_, day) => ({
        tutorId: profile.id,
        isoWeekday: day + 1,
        startMinute: 0,
        endMinute: 1440,
      })),
    );
  return {
    profile,
    id,
    choice: {
      tutorSlugs: [profile.slug],
      subjectSlug: "math",
      level: "elementary" as const,
      displayTimezone: "America/New_York",
    },
    privateChoice: {
      tutorSlug: profile.slug,
      subjectSlug: "math",
      learnerId,
      displayTimezone: "America/New_York",
    },
  };
}
beforeAll(async () => {
  world = openWorld();
  parent = await createAccount(world, ["parent"]);
  other = await createAccount(world, ["parent"]);
  learnerId = await addLearner(parent);
  foreignId = await addLearner(other);
  const [subject] = await world.owner.db
    .select()
    .from(subjects)
    .where(eq(subjects.slug, "math"));
  subjectId = subject.id;
}, 30000);
afterAll(() => closeWorld(world));

describe("privacy-safe public candidate query against real PostgreSQL", () => {
  it("batches several eligible tutors with six SQL statements and returns explicit empty/unavailable", async () => {
    const a = await tutor(),
      b = await tutor(),
      empty = await tutor(true);
    const spies = new Map<PoolClient, ReturnType<typeof vi.spyOn>>();
    const observe = (client: PoolClient) => {
      if (!spies.has(client)) spies.set(client, vi.spyOn(client, "query"));
    };
    world.runtime.pool.on("acquire", observe);
    try {
      const result = await readPublicCandidates(world.runtime, {
        ...a.choice,
        tutorSlugs: [
          b.profile.slug,
          empty.profile.slug,
          "unknown-tutor",
          a.profile.slug,
        ],
        to: new Date(Date.now() + 4 * 3_600_000).toISOString(),
      });
      const calls = [...spies.values()]
        .flatMap((spy) => spy.mock.calls)
        .map((args) => (typeof args[0] === "string" ? args[0] : args[0]?.text))
        .filter((text) => typeof text === "string");
      expect(
        calls.filter((text) => /^(select|SELECT)/.test(text ?? "")),
      ).toHaveLength(6);
      expect(
        calls.some((text) =>
          /learner_profiles|guardian_learner_links|booking_events/.test(
            text ?? "",
          ),
        ),
      ).toBe(false);
      expect(
        calls.some((text) => /^(update|insert|delete)/i.test(text ?? "")),
      ).toBe(false);
      expect(result.tutors.map((row) => row.state)).toEqual([
        "available",
        "empty",
        "unavailable",
        "available",
      ]);
      expect(result.tutors.map((row) => row.tutorSlug)).toEqual([
        b.profile.slug,
        empty.profile.slug,
        "unknown-tutor",
        a.profile.slug,
      ]);
      expect(result.tutors[0].times.map((time) => time.startAtUtc)).toEqual(
        [...result.tutors[0].times.map((time) => time.startAtUtc)].sort(),
      );
      expect(result.source).toBe("local_simulation");
    } finally {
      world.runtime.pool.off("acquire", observe);
      for (const spy of spies.values()) spy.mockRestore();
    }
  });
  it("agrees with authoritative candidates and never discloses private records", async () => {
    const a = await tutor();
    const preview = await readPublicCandidates(world.runtime, a.choice);
    const privateTimes = await readDemoCandidates(
      world.runtime,
      parent.headers,
      a.privateChoice,
    );
    expect(preview.tutors[0].times).toEqual(privateTimes.times);
    const serialized = JSON.stringify(preview);
    for (const privateValue of [
      learnerId,
      foreignId,
      parent.id,
      parent.email,
      a.id,
      a.profile.id,
      "Private synthetic preview learner",
    ])
      expect(serialized.includes(privateValue)).toBe(false);
    expect(Object.keys(preview.tutors[0]).sort()).toEqual([
      "state",
      "times",
      "tutorSlug",
    ]);
    expect(Object.keys(preview.tutors[0].times[0]).sort()).toEqual([
      "date",
      "endAtUtc",
      "startAtUtc",
      "time",
      "tutorTime",
      "zone",
    ]);
  });
  it("uses exact subject-level offering and current approval/account/role/subject eligibility", async () => {
    const a = await tutor();
    const read = async (update = {}) =>
      (await readPublicCandidates(world.runtime, { ...a.choice, ...update }))
        .tutors[0];
    expect((await read({ subjectSlug: "english" })).state).toBe("unavailable");
    expect((await read({ level: "high_school" })).state).toBe("unavailable");
    await world.owner.db
      .update(tutorProfiles)
      .set({ reviewStatus: "suspended" })
      .where(eq(tutorProfiles.id, a.profile.id));
    expect((await read()).state).toBe("unavailable");
    await world.owner.db
      .update(tutorProfiles)
      .set({ reviewStatus: "approved" })
      .where(eq(tutorProfiles.id, a.profile.id));
    await world.owner.db
      .update(userAccess)
      .set({ status: "suspended" })
      .where(eq(userAccess.userId, a.id));
    expect((await read()).state).toBe("unavailable");
    await world.owner.db
      .update(userAccess)
      .set({ status: "active" })
      .where(eq(userAccess.userId, a.id));
    await world.owner.db.delete(userRoles).where(eq(userRoles.userId, a.id));
    expect((await read()).state).toBe("unavailable");
    await world.owner.db
      .insert(userRoles)
      .values({ userId: a.id, role: "tutor" });
    await world.owner.db
      .update(user)
      .set({ emailVerified: false })
      .where(eq(user.id, a.id));
    expect((await read()).state).toBe("unavailable");
    await world.owner.db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.id, a.id));
    await world.owner.db
      .update(subjects)
      .set({ isActive: false })
      .where(eq(subjects.id, subjectId));
    try {
      expect((await read()).state).toBe("unavailable");
    } finally {
      await world.owner.db
        .update(subjects)
        .set({ isActive: true })
        .where(eq(subjects.id, subjectId));
    }
  });
  it("excludes time off and active reservations, ignores elapsed expiry without writes", async () => {
    const a = await tutor();
    const initial = await readPublicCandidates(world.runtime, a.choice);
    const time = initial.tutors[0].times[0];
    await createDemoReservation(world.runtime, parent.headers, {
      ...a.privateChoice,
      startAtUtc: time.startAtUtc,
      endAtUtc: time.endAtUtc,
      idempotencyKey: randomUUID(),
    });
    expect(
      (
        await readPublicCandidates(world.runtime, a.choice)
      ).tutors[0].times.some((row) => row.startAtUtc === time.startAtUtc),
    ).toBe(false);
    const elapsed = initial.tutors[0].times[3];
    const elapsedInput = {
      ...a.privateChoice,
      startAtUtc: elapsed.startAtUtc,
      endAtUtc: elapsed.endAtUtc,
      idempotencyKey: randomUUID(),
    };
    const [expired] = await world.owner.db
      .insert(bookings)
      .values({
        source: "local_simulation",
        tutorId: a.profile.id,
        learnerId,
        bookedByUserId: parent.id,
        subjectId,
        startAtUtc: new Date(elapsed.startAtUtc),
        endAtUtc: new Date(elapsed.endAtUtc),
        displayTimezone: "UTC",
        idempotencyKey: elapsedInput.idempotencyKey,
        requestFingerprint: bookingFingerprint(elapsedInput),
        state: "demo_reserved",
        createdAt: new Date(Date.now() - 20 * 60_000),
        expiresAt: new Date(Date.now() - 10 * 60_000),
      })
      .returning({ id: bookings.id });
    const before = await world.owner.pool.query(
      "SELECT state,(SELECT count(*)::int FROM booking_events WHERE booking_id=$1) AS events FROM bookings WHERE id=$1",
      [expired.id],
    );
    expect(
      (
        await readPublicCandidates(world.runtime, a.choice)
      ).tutors[0].times.some((row) => row.startAtUtc === elapsed.startAtUtc),
    ).toBe(true);
    expect(
      (
        await world.owner.pool.query(
          "SELECT state,(SELECT count(*)::int FROM booking_events WHERE booking_id=$1) AS events FROM bookings WHERE id=$1",
          [expired.id],
        )
      ).rows,
    ).toEqual(before.rows);
    await world.owner.db.insert(tutorAvailabilityExceptions).values({
      tutorId: a.profile.id,
      startAtUtc: new Date(time.startAtUtc),
      endAtUtc: new Date(time.endAtUtc),
    });
    expect(
      (
        await readPublicCandidates(world.runtime, a.choice)
      ).tutors[0].times.some((row) => row.startAtUtc === time.startAtUtc),
    ).toBe(false);
  });
  it("checks a candidate's whole duration for time off beyond the default horizon", async () => {
    const a = await tutor();
    const initial = await readDemoCandidates(
      world.runtime,
      parent.headers,
      a.privateChoice,
    );
    const last = initial.times.at(-1)!;
    const start = new Date(new Date(last.startAtUtc).getTime() + 45 * 60_000);
    expect(start.getTime()).toBeGreaterThan(Date.now() + 14 * 86_400_000);
    await world.owner.db.insert(tutorAvailabilityExceptions).values({
      tutorId: a.profile.id,
      startAtUtc: start,
      endAtUtc: new Date(start.getTime() + 60_000),
    });
    expect(
      (
        await readDemoCandidates(world.runtime, parent.headers, a.privateChoice)
      ).times.some((row) => row.startAtUtc === last.startAtUtc),
    ).toBe(false);
    expect(
      (
        await readPublicCandidates(world.runtime, a.choice)
      ).tutors[0].times.some((row) => row.startAtUtc === last.startAtUtc),
    ).toBe(false);
  });
  it("loads a busy reservation starting after a requested range but before its candidate ends", async () => {
    const a = await tutor();
    const initial = await readDemoCandidates(
      world.runtime,
      parent.headers,
      a.privateChoice,
    );
    const first = initial.times[0],
      second = initial.times[1];
    await createDemoReservation(world.runtime, parent.headers, {
      ...a.privateChoice,
      startAtUtc: second.startAtUtc,
      endAtUtc: second.endAtUtc,
      idempotencyKey: randomUUID(),
    });
    const to = new Date(
      new Date(first.startAtUtc).getTime() + 15 * 60_000,
    ).toISOString();
    expect(
      (await readPublicCandidates(world.runtime, { ...a.choice, to })).tutors[0]
        .state,
    ).toBe("empty");
  });
  it("returns empty for an out-of-horizon range, rejects overflow rather than a partial scan", async () => {
    const a = await tutor(true);
    expect(
      (
        await readPublicCandidates(world.runtime, {
          ...a.choice,
          from: "2020-01-01T00:00:00Z",
          to: "2020-01-02T00:00:00Z",
        })
      ).tutors[0].state,
    ).toBe("empty");
    await world.owner.db.insert(tutorAvailability).values(
      Array.from({ length: 841 }, (_, minute) => ({
        tutorId: a.profile.id,
        isoWeekday: 1,
        startMinute: minute,
        endMinute: minute + 1,
      })),
    );
    await expect(
      readPublicCandidates(world.runtime, a.choice),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("public endpoint requires no auth but rejects forged/repeated/private inputs and stays no-store", async () => {
    const a = await tutor();
    const url = `/api/tutors/${a.profile.slug}/availability?${new URLSearchParams({ subjectSlug: "math", level: "elementary", displayTimezone: "Asia/Manila" })}`;
    const request = (suffix = "") =>
      new Request(`${world.runtime.origin}${url}${suffix}`);
    const success = await handlePublicCandidateRead(
      world.runtime,
      request(),
      a.profile.slug,
    );
    expect(success.status).toBe(200);
    expect(success.headers.get("cache-control")).toContain("no-store");
    for (const suffix of [
      "&level=college_support",
      `&learnerId=${foreignId}`,
      "&now=2026-11-01T00:00:00Z",
      "&tutorSlugs=forged",
      "&from=bad",
    ])
      expect(
        (
          await handlePublicCandidateRead(
            world.runtime,
            request(suffix),
            a.profile.slug,
          )
        ).status,
      ).toBe(400);
    expect(
      (await handlePublicCandidateRead(null, request(), a.profile.slug)).status,
    ).toBe(503);
    expect(
      (
        await handlePublicCandidateRead(
          {
            ...world.runtime,
            environment: "production",
          } as unknown as World["runtime"],
          request(),
          a.profile.slug,
        )
      ).status,
    ).toBe(503);
    expect(
      (
        await handlePublicCandidateRead(
          world.runtime,
          new Request(`http://evil.test${url}`),
          a.profile.slug,
        )
      ).status,
    ).toBe(403);
  });
  it("resumes only after auth, rechecks learner/fit/time, and never creates automatically", async () => {
    const a = await tutor();
    const initial = await readPublicCandidates(world.runtime, a.choice);
    const time = initial.tutors[0].times[0];
    const choice = {
      tutorSlug: a.profile.slug,
      subjectSlug: "math",
      level: "elementary" as const,
      displayTimezone: "America/New_York",
      startAtUtc: time.startAtUtc,
      endAtUtc: time.endAtUtc,
    };
    await expect(
      loadDemoBookingResume(world.runtime, new Headers(), choice),
    ).rejects.toMatchObject({ status: 401 });
    const before = await world.owner.pool.query(
      "SELECT count(*)::int AS count FROM bookings WHERE tutor_id=$1",
      [a.profile.id],
    );
    const resumed = await loadDemoBookingResume(
      world.runtime,
      parent.headers,
      choice,
    );
    expect(resumed.choice).toEqual(choice);
    expect(
      resumed.times?.some((row) => row.startAtUtc === time.startAtUtc),
    ).toBe(true);
    expect(
      (
        await world.owner.pool.query(
          "SELECT count(*)::int AS count FROM bookings WHERE tutor_id=$1",
          [a.profile.id],
        )
      ).rows,
    ).toEqual(before.rows);
    await expect(
      createDemoReservation(world.runtime, parent.headers, {
        ...a.privateChoice,
        learnerId: foreignId,
        startAtUtc: time.startAtUtc,
        endAtUtc: time.endAtUtc,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toBeDefined();
    await createDemoReservation(world.runtime, other.headers, {
      learnerId: foreignId,
      tutorSlug: a.profile.slug,
      subjectSlug: "math",
      displayTimezone: "UTC",
      startAtUtc: time.startAtUtc,
      endAtUtc: time.endAtUtc,
      idempotencyKey: randomUUID(),
    });
    const stale = await loadDemoBookingResume(
      world.runtime,
      parent.headers,
      choice,
    );
    expect(stale.message).toContain("no longer available");
    expect(stale.times?.some((row) => row.startAtUtc === time.startAtUtc)).toBe(
      false,
    );
    expect(stale.times?.length).toBeGreaterThan(0);
  });
});
