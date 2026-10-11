import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  bookings,
  learnerProfiles,
  subjects,
  tutorAvailability,
  tutorAvailabilityExceptions,
  tutorProfiles,
  user,
  userAccess,
  userRoles,
} from "@/lib/db/schema";
import {
  listEligibleTutors,
  type PublicTutor,
} from "@/features/tutors/eligibility";
import { readMatchingAvailability } from "@/features/matching/service";
import { preferencePredicate } from "@/features/matching/preferences";
import { readPublicCandidates } from "@/features/public-availability/service";
import { publicProfileHref } from "@/features/public-availability/links";
import { readDemoCandidates } from "@/features/bookings/service";
import {
  closeWorld,
  createAccount,
  openWorld,
  type TestAccount,
  type World,
} from "./support";

let world: World, actor: TestAccount, learnerId: string, subjectId: string;
const ownedProfiles: string[] = [];
beforeAll(async () => {
  world = openWorld();
  actor = await createAccount(world, ["student"]);
  const [learner] = await world.owner.db
    .insert(learnerProfiles)
    .values({
      fixtureKey: randomUUID(),
      source: "local_fixture",
      management: "self",
      userId: actor.id,
      displayName: "Synthetic matching learner",
      level: "college_support",
      timezone: "Asia/Manila",
    })
    .returning();
  learnerId = learner.id;
  subjectId = (
    await world.owner.db
      .select()
      .from(subjects)
      .where(eq(subjects.slug, "math"))
  )[0].id;
}, 30000);
afterAll(async () => {
  if (world && ownedProfiles.length)
    await world.owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE id=ANY($1::uuid[])",
      [ownedProfiles],
    );
  await closeWorld(world);
});

async function fresh(timezone = "Asia/Manila") {
  const ownerId = randomUUID();
  await world.owner.db.insert(user).values({
    id: ownerId,
    name: "Synthetic matching tutor",
    email: `matching-${ownerId}@learli.test`,
    emailVerified: true,
  });
  await world.owner.db.insert(userAccess).values({ userId: ownerId });
  await world.owner.db
    .insert(userRoles)
    .values({ userId: ownerId, role: "tutor" });
  const [profile] = await world.owner.db
    .insert(tutorProfiles)
    .values({
      userId: ownerId,
      slug: `matching-${ownerId}`,
      headline: "Synthetic tutor",
      bio: "Fictional matching fixture.",
      teachingBackground: "Local only.",
      timezone,
      reviewStatus: "approved",
    })
    .returning();
  ownedProfiles.push(profile.id);
  await world.owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) VALUES ($1,$2,ARRAY['college_support']::text[])",
    [profile.id, subjectId],
  );
  await world.owner.db.insert(tutorAvailability).values(
    Array.from({ length: 7 }, (_, i) => ({
      tutorId: profile.id,
      isoWeekday: i + 1,
      startMinute: 0,
      endMinute: 1440,
    })),
  );
  const tutors = (await listEligibleTutors(world.runtime.db)).filter(
    (tutor) => tutor.slug === profile.slug,
  );
  return { profile, ownerId, tutors };
}
const answers = {
  subjectSlug: "math",
  level: "college_support" as const,
  preferences: { timezone: "America/Los_Angeles", when: "any" as const },
};
const publicInput = (slug: string) => ({
  tutorSlugs: [slug],
  subjectSlug: "math",
  level: "college_support",
  displayTimezone: "America/Los_Angeles",
});
const sameTime = (
  a: { startAtUtc: string; endAtUtc: string },
  b: { startAtUtc: string; endAtUtc: string },
) => a.startAtUtc === b.startAtUtc && a.endAtUtc === b.endAtUtc;

describe("real PostgreSQL availability matching", () => {
  it("uses the same actual tutor/time as the public profile query and authoritative private preview", async () => {
    const { profile, tutors } = await fresh();
    const result = await readMatchingAvailability(
      world.runtime,
      tutors,
      answers,
    );
    expect(result.matches).toHaveLength(1);
    const time = result.matches[0].nextTime;
    const publicTimes = await readPublicCandidates(
      world.runtime,
      publicInput(profile.slug),
    );
    expect(
      publicTimes.tutors[0].times.some((candidate) =>
        sameTime(candidate, time),
      ),
    ).toBe(true);
    const privateTimes = await readDemoCandidates(
      world.runtime,
      actor.headers,
      {
        learnerId,
        tutorSlug: profile.slug,
        subjectSlug: "math",
        displayTimezone: answers.preferences.timezone,
      },
    );
    expect(
      privateTimes.times.some((candidate) => sameTime(candidate, time)),
    ).toBe(true);
    const href = publicProfileHref({
      tutorSlug: profile.slug,
      subjectSlug: "math",
      level: "college_support",
      displayTimezone: answers.preferences.timezone,
      startAtUtc: time.startAtUtc,
      endAtUtc: time.endAtUtc,
    });
    const url = new URL(href, "http://127.0.0.1");
    expect(url.searchParams.get("startAtUtc")).toBe(time.startAtUtc);
    expect(url.searchParams.has("learnerId")).toBe(false);
  });
  it("excludes unexpired reservations and time off, but reads expired reserved rows without mutating them", async () => {
    const { profile, tutors } = await fresh();
    const preview = await readPublicCandidates(
      world.runtime,
      publicInput(profile.slug),
    );
    const [busy, , off, , stale] = preview.tutors[0].times;
    const now = new Date(
      (await world.owner.pool.query("SELECT clock_timestamp() AS now")).rows[0]
        .now,
    );
    const ids: string[] = [];
    for (const [time, expired] of [
      [busy, false],
      [stale, true],
    ] as const) {
      const [row] = await world.owner.db
        .insert(bookings)
        .values({
          source: "local_simulation",
          tutorId: profile.id,
          learnerId,
          bookedByUserId: actor.id,
          subjectId,
          startAtUtc: new Date(time.startAtUtc),
          endAtUtc: new Date(time.endAtUtc),
          displayTimezone: "UTC",
          idempotencyKey: randomUUID(),
          requestFingerprint: "a".repeat(64),
          state: "demo_reserved",
          createdAt: new Date(now.getTime() - (expired ? 20 : 0) * 60000),
          expiresAt: new Date(now.getTime() + (expired ? -10 : 10) * 60000),
        })
        .returning({ id: bookings.id });
      ids.push(row.id);
    }
    await world.owner.db.insert(tutorAvailabilityExceptions).values({
      tutorId: profile.id,
      startAtUtc: new Date(off.startAtUtc),
      endAtUtc: new Date(off.endAtUtc),
    });
    const result = await readMatchingAvailability(
      world.runtime,
      tutors,
      answers,
    );
    const refreshed = await readPublicCandidates(
      world.runtime,
      publicInput(profile.slug),
    );
    expect(refreshed.tutors[0].times.some((time) => sameTime(time, busy))).toBe(
      false,
    );
    expect(refreshed.tutors[0].times.some((time) => sameTime(time, off))).toBe(
      false,
    );
    expect(
      refreshed.tutors[0].times.some((time) => sameTime(time, stale)),
    ).toBe(true);
    expect(sameTime(result.matches[0].nextTime, stale)).toBe(true);
    const state = await world.owner.pool.query(
      "SELECT state FROM bookings WHERE id=ANY($1::uuid[])",
      [ids],
    );
    expect(state.rows.every((row) => row.state === "demo_reserved")).toBe(true);
    expect(JSON.stringify(result).includes(learnerId)).toBe(false);
    expect(JSON.stringify(result).includes(actor.email)).toBe(false);
    expect(JSON.stringify(result).includes("requestFingerprint")).toBe(false);
  });
  it.each(["profile", "account", "verification", "role"])(
    "rechecks %s eligibility after the catalog snapshot",
    async (boundary) => {
      const { profile, ownerId, tutors } = await fresh();
      if (boundary === "profile")
        await world.owner.db
          .update(tutorProfiles)
          .set({ reviewStatus: "suspended" })
          .where(eq(tutorProfiles.id, profile.id));
      if (boundary === "account")
        await world.owner.db
          .update(userAccess)
          .set({ status: "suspended" })
          .where(eq(userAccess.userId, ownerId));
      if (boundary === "verification")
        await world.owner.db
          .update(user)
          .set({ emailVerified: false })
          .where(eq(user.id, ownerId));
      if (boundary === "role")
        await world.owner.pool.query(
          "DELETE FROM user_roles WHERE user_id=$1",
          [ownerId],
        );
      expect(
        (await readMatchingAvailability(world.runtime, tutors, answers))
          .matches,
      ).toHaveLength(0);
    },
  );
  it("keeps subject and level on the same offering and respects removed offerings", async () => {
    const { profile, tutors } = await fresh();
    await world.owner.pool.query(
      "UPDATE tutor_subjects SET levels=ARRAY['elementary']::text[] WHERE tutor_id=$1",
      [profile.id],
    );
    expect(
      (await readMatchingAvailability(world.runtime, tutors, answers)).matches,
    ).toHaveLength(0);
    expect(
      await listEligibleTutors(world.runtime.db, {
        subject: "math",
        level: "college_support",
      }).then((rows) => rows.some((row) => row.slug === profile.slug)),
    ).toBe(false);
  });
  it("batches 21 eligible tutors into two actual snapshots and refuses overflow before querying", async () => {
    const tutors: PublicTutor[] = [];
    for (let i = 0; i < 21; i++) tutors.push(...(await fresh()).tutors);
    const transaction = vi.spyOn(world.runtime.db, "transaction");
    try {
      const result = await readMatchingAvailability(
        world.runtime,
        tutors,
        answers,
      );
      expect(result.matches).toHaveLength(21);
      expect(transaction).toHaveBeenCalledTimes(2);
      transaction.mockClear();
      await expect(
        readMatchingAvailability(
          world.runtime,
          Array.from({ length: 101 }, (_, i) => ({
            ...tutors[0],
            slug: `overflow-${i}`,
          })),
          answers,
        ),
      ).rejects.toMatchObject({ status: 503 });
      expect(transaction).not.toHaveBeenCalled();
    } finally {
      transaction.mockRestore();
    }
  });
  it("returns honest empty results without a query for absent genuine offerings", async () => {
    const { tutors } = await fresh();
    const transaction = vi.spyOn(world.runtime.db, "transaction");
    try {
      expect(
        await readMatchingAvailability(world.runtime, tutors, {
          ...answers,
          subjectSlug: "science",
        }),
      ).toEqual({ matches: [], window: null });
      expect(transaction).not.toHaveBeenCalled();
    } finally {
      transaction.mockRestore();
    }
  });
  it("filters actual local dates with representative viewer zones and whole interval boundaries", async () => {
    const { profile, tutors } = await fresh("Australia/Lord_Howe");
    for (const timezone of [
      "Pacific/Kiritimati",
      "America/Los_Angeles",
      "Australia/Lord_Howe",
      "Europe/London",
    ]) {
      const preferences = {
        timezone,
        when: "preferred" as const,
        days: [1, 7],
        range: "morning" as const,
      };
      const result = await readMatchingAvailability(world.runtime, tutors, {
        ...answers,
        preferences,
      });
      expect(result.matches).toHaveLength(1);
      const preview = await readPublicCandidates(world.runtime, {
        ...publicInput(profile.slug),
        displayTimezone: timezone,
      });
      const fit = preferencePredicate(
        preferences,
        new Date(preview.from),
        new Date(new Date(preview.to).getTime() + 3600000),
      );
      expect(fit(result.matches[0].nextTime)).toBe(true);
      expect(
        preview.tutors[0].times.some((time) =>
          sameTime(time, result.matches[0].nextTime),
        ),
      ).toBe(true);
    }
  });
  it("rejects private fields and hosted runtimes without public queries", async () => {
    const { profile } = await fresh();
    await expect(
      readPublicCandidates(world.runtime, {
        ...publicInput(profile.slug),
        learnerId,
      }),
    ).rejects.toThrow();
    await expect(
      readPublicCandidates(
        { ...world.runtime, origin: "https://invalid.example" },
        publicInput(profile.slug),
      ),
    ).rejects.toMatchObject({ status: 503 });
  });
});
