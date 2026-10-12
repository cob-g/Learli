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
import { readDirectoryAvailability } from "@/features/tutors/directory-availability";
import { readMatchingAvailability } from "@/features/matching/service";
import {
  readPublicCandidates,
  readPublicDirectoryCandidates,
} from "@/features/public-availability/service";
import { preferencePredicate } from "@/features/matching/preferences";
import { closeWorld, openWorld, type World } from "./support";

let world: World, subjectId: string, learnerId: string, actorId: string;
const owned: string[] = [];
const preferences = { timezone: "UTC", when: "any" as const };
const filters = {
  subject: "math",
  level: "college_support" as const,
  language: "en" as const,
};
beforeAll(async () => {
  world = openWorld();
  subjectId = (
    await world.owner.db
      .select()
      .from(subjects)
      .where(eq(subjects.slug, "math"))
  )[0].id;
  actorId = randomUUID();
  await world.owner.db.insert(user).values({
    id: actorId,
    name: "Synthetic directory learner",
    email: `directory-${actorId}@learli.test`,
    emailVerified: true,
  });
  learnerId = (
    await world.owner.db
      .insert(learnerProfiles)
      .values({
        fixtureKey: randomUUID(),
        source: "local_fixture",
        management: "self",
        userId: actorId,
        displayName: "Synthetic directory learner",
        level: "college_support",
        timezone: "UTC",
      })
      .returning()
  )[0].id;
});
afterAll(async () => {
  if (world && owned.length)
    await world.owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE id=ANY($1::uuid[])",
      [owned],
    );
  await closeWorld(world);
});
async function fresh(name = "Synthetic directory tutor", timezone = "UTC") {
  const id = randomUUID();
  await world.owner.db.insert(user).values({
    id,
    name,
    email: `directory-${id}@learli.test`,
    emailVerified: true,
  });
  await world.owner.db.insert(userAccess).values({ userId: id });
  await world.owner.db.insert(userRoles).values({ userId: id, role: "tutor" });
  const profile = (
    await world.owner.db
      .insert(tutorProfiles)
      .values({
        userId: id,
        slug: `directory-${id}`,
        headline: "Synthetic",
        bio: "Fictional local fixture",
        teachingBackground: "Local only",
        timezone,
        reviewStatus: "approved",
      })
      .returning()
  )[0];
  owned.push(profile.id);
  await world.owner.pool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) VALUES ($1,$2,ARRAY['college_support']::text[])",
    [profile.id, subjectId],
  );
  await world.owner.pool.query(
    "INSERT INTO tutor_teaching_languages(tutor_id,language_code) VALUES ($1,'en')",
    [profile.id],
  );
  await world.owner.db.insert(tutorAvailability).values(
    Array.from({ length: 7 }, (_, i) => ({
      tutorId: profile.id,
      isoWeekday: i + 1,
      startMinute: 0,
      endMinute: 1440,
    })),
  );
  return {
    id,
    profile,
    tutors: (await listEligibleTutors(world.runtime.db)).filter(
      (tutor) => tutor.slug === profile.slug,
    ),
  };
}
const publicInput = (slug: string) => ({
  tutorSlugs: [slug],
  subjectSlug: "math",
  level: "college_support",
  displayTimezone: "UTC",
});
const same = (
  a: { startAtUtc: string; endAtUtc: string },
  b: { startAtUtc: string; endAtUtc: string },
) => a.startAtUtc === b.startAtUtc && a.endAtUtc === b.endAtUtc;

describe("isolated PostgreSQL directory availability", () => {
  it("keeps a valid constructor slug without dated availability out of exact results", async () => {
    const { profile } = await fresh();
    await world.owner.db
      .update(tutorProfiles)
      .set({ slug: "constructor" })
      .where(eq(tutorProfiles.id, profile.id));
    await world.owner.db
      .delete(tutorAvailability)
      .where(eq(tutorAvailability.tutorId, profile.id));
    try {
      const tutors = (await listEligibleTutors(world.runtime.db)).filter(
        (tutor) => tutor.slug === "constructor",
      );
      expect(tutors).toHaveLength(1);
      expect(
        await readDirectoryAvailability(
          world.runtime,
          tutors,
          filters,
          preferences,
        ),
      ).toEqual({ tutors: [], nextTimes: {} });
    } finally {
      await world.owner.db
        .update(tutorProfiles)
        .set({ slug: profile.slug })
        .where(eq(tutorProfiles.id, profile.id));
    }
  });
  it("agrees with matching and the original profile provider while keeping the public projection minimal", async () => {
    const { profile, tutors } = await fresh();
    const directory = await readDirectoryAvailability(
      world.runtime,
      tutors,
      filters,
      preferences,
    );
    const matching = await readMatchingAvailability(world.runtime, tutors, {
      subjectSlug: "math",
      level: "college_support",
      preferences,
    });
    const profileTimes = await readPublicCandidates(
      world.runtime,
      publicInput(profile.slug),
    );
    const next = directory.nextTimes[profile.slug];
    expect(same(next, matching.matches[0].nextTime)).toBe(true);
    expect(profileTimes.tutors[0].times.some((time) => same(time, next))).toBe(
      true,
    );
    expect(Object.keys(next).sort()).toEqual([
      "date",
      "endAtUtc",
      "startAtUtc",
      "time",
      "zone",
    ]);
    const serialized = JSON.stringify(directory);
    for (const canary of [
      profile.id,
      learnerId,
      actorId,
      "@learli.test",
      "meetingUrl",
      "requestFingerprint",
    ])
      expect(serialized.includes(canary)).toBe(false);
    expect(
      (
        await readPublicDirectoryCandidates(world.runtime, {
          tutorSlugs: [profile.slug],
          displayTimezone: "UTC",
        })
      ).tutors[0].state,
    ).toBe("available");
  });
  it("excludes time off and live reservations, includes expired holds and performs no mutation", async () => {
    const { profile, tutors } = await fresh();
    const preview = await readPublicCandidates(
      world.runtime,
      publicInput(profile.slug),
    );
    const [busy, , off, , expired] = preview.tutors[0].times;
    const now = new Date(
      (await world.owner.pool.query("SELECT clock_timestamp() AS now")).rows[0]
        .now,
    );
    const ids: string[] = [];
    for (const [time, stale] of [
      [busy, false],
      [expired, true],
    ] as const) {
      const row = (
        await world.owner.db
          .insert(bookings)
          .values({
            source: "local_simulation",
            tutorId: profile.id,
            learnerId,
            bookedByUserId: actorId,
            subjectId,
            startAtUtc: new Date(time.startAtUtc),
            endAtUtc: new Date(time.endAtUtc),
            displayTimezone: "UTC",
            idempotencyKey: randomUUID(),
            requestFingerprint: "a".repeat(64),
            state: "demo_reserved",
            createdAt: new Date(now.getTime() - (stale ? 20 : 0) * 60000),
            expiresAt: new Date(now.getTime() + (stale ? -10 : 10) * 60000),
          })
          .returning({ id: bookings.id })
      )[0];
      ids.push(row.id);
    }
    await world.owner.db.insert(tutorAvailabilityExceptions).values({
      tutorId: profile.id,
      startAtUtc: new Date(off.startAtUtc),
      endAtUtc: new Date(off.endAtUtc),
    });
    const directory = await readDirectoryAvailability(
      world.runtime,
      tutors,
      filters,
      preferences,
    );
    expect(same(directory.nextTimes[profile.slug], expired)).toBe(true);
    expect(
      (
        await world.owner.pool.query(
          "SELECT state FROM bookings WHERE id=ANY($1::uuid[])",
          [ids],
        )
      ).rows.every((row) => row.state === "demo_reserved"),
    ).toBe(true);
  });
  it.each([
    "profile",
    "account",
    "verification",
    "role",
    "language",
    "offering",
  ])(
    "rechecks %s eligibility after the initial catalog read",
    async (boundary) => {
      const { id, profile, tutors } = await fresh();
      if (boundary === "profile")
        await world.owner.db
          .update(tutorProfiles)
          .set({ reviewStatus: "suspended" })
          .where(eq(tutorProfiles.id, profile.id));
      if (boundary === "account")
        await world.owner.db
          .update(userAccess)
          .set({ status: "suspended" })
          .where(eq(userAccess.userId, id));
      if (boundary === "verification")
        await world.owner.db
          .update(user)
          .set({ emailVerified: false })
          .where(eq(user.id, id));
      if (boundary === "role")
        await world.owner.pool.query(
          "DELETE FROM user_roles WHERE user_id=$1",
          [id],
        );
      if (boundary === "language")
        await world.owner.pool.query(
          "DELETE FROM tutor_teaching_languages WHERE tutor_id=$1",
          [profile.id],
        );
      if (boundary === "offering")
        await world.owner.pool.query(
          "UPDATE tutor_subjects SET levels=ARRAY['elementary']::text[] WHERE tutor_id=$1",
          [profile.id],
        );
      expect(
        (
          await readDirectoryAvailability(
            world.runtime,
            tutors,
            filters,
            preferences,
          )
        ).tutors,
      ).toHaveLength(0);
    },
  );
  it("checks active subjects and same-offering combinations without changing catalog policy", async () => {
    const { profile, tutors } = await fresh();
    const custom = (
      await world.owner.db
        .insert(subjects)
        .values({
          slug: `directory-${randomUUID()}`,
          name: `Synthetic directory subject ${randomUUID().slice(0, 8)}`,
          category: "specialized",
          isActive: true,
        })
        .returning()
    )[0];
    await world.owner.pool.query(
      "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) VALUES ($1,$2,ARRAY['elementary']::text[])",
      [profile.id, custom.id],
    );
    const refreshed = (await listEligibleTutors(world.runtime.db)).filter(
      (tutor) => tutor.slug === profile.slug,
    );
    expect(
      (
        await readDirectoryAvailability(
          world.runtime,
          refreshed,
          { subject: custom.slug, level: "college_support" },
          preferences,
        )
      ).tutors,
    ).toHaveLength(0);
    await world.owner.db
      .update(subjects)
      .set({ isActive: false })
      .where(eq(subjects.id, custom.id));
    expect(
      (
        await readDirectoryAvailability(
          world.runtime,
          refreshed,
          { subject: custom.slug },
          preferences,
        )
      ).tutors,
    ).toHaveLength(0);
    expect(
      (
        await readDirectoryAvailability(
          world.runtime,
          tutors,
          { level: "college_support" },
          preferences,
        )
      ).tutors,
    ).toHaveLength(1);
  });
  it("keeps all 21 matches in catalog order across complete provider batches and rejects overflow before a query", async () => {
    const tutors: PublicTutor[] = [];
    for (let i = 0; i < 21; i++)
      tutors.push(
        ...(await fresh(`Synthetic directory ${String(i).padStart(2, "0")}`))
          .tutors,
      );
    const transaction = vi.spyOn(world.runtime.db, "transaction");
    try {
      const result = await readDirectoryAvailability(
        world.runtime,
        tutors,
        filters,
        preferences,
      );
      expect(result.tutors.map((tutor) => tutor.slug)).toEqual(
        tutors.map((tutor) => tutor.slug),
      );
      expect(transaction).toHaveBeenCalledTimes(2);
      expect(result.tutors.slice(20)).toHaveLength(1);
      transaction.mockClear();
      await expect(
        readDirectoryAvailability(
          world.runtime,
          Array.from({ length: 101 }, (_, i) => ({
            ...tutors[0],
            slug: `overflow-${i}`,
          })),
          {},
          preferences,
        ),
      ).rejects.toMatchObject({ status: 503 });
      expect(transaction).not.toHaveBeenCalled();
      expect(
        await readDirectoryAvailability(
          world.runtime,
          tutors,
          { subject: "no-offering" },
          preferences,
        ),
      ).toEqual({ tutors: [], nextTimes: {} });
      expect(transaction).not.toHaveBeenCalled();
    } finally {
      transaction.mockRestore();
    }
  });
  it("fits complete dated intervals in viewer zones and rejects hosted/private inputs", async () => {
    const { profile, tutors } = await fresh("Australia/Lord_Howe");
    for (const timezone of [
      "America/Los_Angeles",
      "Australia/Lord_Howe",
      "Pacific/Kiritimati",
      "Europe/London",
    ]) {
      const selected = {
        timezone,
        when: "preferred" as const,
        days: [1, 7],
        range: "morning" as const,
      };
      const result = await readDirectoryAvailability(
        world.runtime,
        tutors,
        {},
        selected,
      );
      const preview = await readPublicCandidates(world.runtime, {
        ...publicInput(profile.slug),
        displayTimezone: timezone,
      });
      expect(
        preferencePredicate(
          selected,
          new Date(preview.from),
          new Date(Date.parse(preview.to) + 3600000),
        )(result.nextTimes[profile.slug]),
      ).toBe(true);
    }
    await expect(
      readPublicDirectoryCandidates(
        { ...world.runtime, origin: "https://invalid.example" },
        {},
      ),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      readPublicDirectoryCandidates(world.runtime, {
        ...publicInput(profile.slug),
        learnerId,
      }),
    ).rejects.toThrow();
  });
});
