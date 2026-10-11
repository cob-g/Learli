import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  handleAvailabilityRead,
  handleAvailabilitySave,
} from "@/features/availability/handler";
import {
  readOwnAvailability,
  readOwnAvailabilityIntervals,
} from "@/features/availability/service";
import { saveOwnTutorProfile } from "@/features/tutors/service";
import { tutorProfiles, user, userAccess } from "@/lib/db/schema";
import {
  openWorld,
  closeWorld,
  createAccount,
  jsonRequest,
  type World,
  type TestAccount,
} from "./support";
let world: World;
const hours = [{ isoWeekday: 1, startMinute: 540, endMinute: 600 }];
const schedule = { version: 0, timezone: "Asia/Manila", windows: hours };
async function tutor() {
  const account = await createAccount(world, ["tutor"]);
  const [profile] = await world.owner.db
    .insert(tutorProfiles)
    .values({
      userId: account.id,
      slug: `test-${randomUUID()}`,
      headline: "Synthetic tutor",
      bio: "Synthetic",
      teachingBackground: "Synthetic",
      timezone: "Asia/Manila",
    })
    .returning();
  return { ...account, profileId: profile.id };
}
function save(
  account: { cookie?: string },
  body: unknown = schedule,
  origin?: string,
) {
  return handleAvailabilitySave(
    world.runtime,
    jsonRequest(world, "/api/tutor/availability", {
      cookie: account.cookie,
      method: "PUT",
      body,
      origin,
    }),
  );
}
function read(account: { cookie?: string }) {
  return handleAvailabilityRead(
    world.runtime,
    jsonRequest(world, "/api/tutor/availability", {
      cookie: account.cookie,
      method: "GET",
    }),
  );
}
async function changeProfile(account: TestAccount, timezone: string) {
  const { rows } = await world.owner.pool.query(
    "SELECT id FROM subjects WHERE slug = 'math'",
  );
  return saveOwnTutorProfile(world.runtime, account.headers, {
    headline: "Synthetic tutor",
    bio: "Synthetic",
    teachingBackground: "Synthetic",
    timezone,
    offerings: [{ subjectId: rows[0].id, levels: ["high_school"] }],
  });
}
beforeAll(() => {
  world = openWorld();
});
beforeEach(async () => {
  await world.owner.pool.query(
    'TRUNCATE TABLE "user", rate_limit, verification CASCADE',
  );
});
afterAll(async () => {
  await closeWorld(world);
});

describe("owner-scoped weekly availability", () => {
  it("loads empty, saves, replaces and clears with an audit trail and no private IDs", async () => {
    const account = await tutor();
    expect(
      await readOwnAvailability(world.runtime, account.headers),
    ).toMatchObject({ version: 0, windows: [] });
    const response = await save(account);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(
      await readOwnAvailability(world.runtime, account.headers),
    ).toMatchObject({ version: 1, windows: hours });
    expect(
      (await save(account, { ...schedule, version: 1, windows: [] })).status,
    ).toBe(200);
    const result = await read(account);
    expect(result.headers.get("cache-control")).toContain("no-store");
    const body = await result.json();
    expect(body.schedule).toMatchObject({ version: 2, windows: [] });
    expect(JSON.stringify(body)).not.toContain(account.id);
    expect(JSON.stringify(body)).not.toContain(account.profileId);
    const audit = await world.owner.pool.query(
      "SELECT action FROM audit_events WHERE target_user_id=$1 AND action='tutor_availability.updated'",
      [account.id],
    );
    expect(audit.rowCount).toBe(2);
  });
  it("denies anonymous, non-tutor and admin-only accounts, and forged owner fields", async () => {
    expect((await save({})).status).toBe(401);
    expect((await read({})).status).toBe(401);
    for (const roles of [[], ["student"], ["parent"], ["admin"]] as const) {
      const account = await createAccount(world, [...roles]);
      expect((await save(account)).status).toBe(403);
      expect((await read(account)).status).toBe(403);
    }
    const a = await tutor(),
      b = await tutor();
    expect((await save(a, { ...schedule, tutorId: b.profileId })).status).toBe(
      400,
    );
    expect((await save(a)).status).toBe(200);
    expect(
      (await readOwnAvailability(world.runtime, b.headers))?.windows,
    ).toEqual([]);
  });
  it("blocks unverified/suspended accounts and suspended tutor profiles", async () => {
    const a = await tutor();
    await world.owner.db
      .update(user)
      .set({ emailVerified: false })
      .where(eq(user.id, a.id));
    expect((await save(a)).status).toBe(403);
    expect((await read(a)).status).toBe(403);
    await world.owner.db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.id, a.id));
    await world.owner.db
      .update(userAccess)
      .set({ status: "suspended" })
      .where(eq(userAccess.userId, a.id));
    expect((await save(a)).status).toBe(403);
    await world.owner.db
      .update(userAccess)
      .set({ status: "active" })
      .where(eq(userAccess.userId, a.id));
    await world.owner.db
      .update(tutorProfiles)
      .set({ reviewStatus: "suspended" })
      .where(eq(tutorProfiles.id, a.profileId));
    expect((await save(a)).status).toBe(409);
    expect(
      (await readOwnAvailability(world.runtime, a.headers))?.editable,
    ).toBe(false);
  });
  it("requires a profile and same-origin bounded valid input", async () => {
    const account = await createAccount(world, ["tutor"]);
    expect((await save(account)).status).toBe(409);
    const a = await tutor();
    expect((await save(a, schedule, "https://elsewhere.example")).status).toBe(
      403,
    );
    expect(
      (await save(a, { ...schedule, windows: [hours[0], hours[0]] })).status,
    ).toBe(400);
    expect((await save(a, { ...schedule, timezone: "EST" })).status).toBe(400);
    expect(
      (await save(a, { ...schedule, extra: "x".repeat(9000) })).status,
    ).toBe(400);
    expect((await readOwnAvailability(world.runtime, a.headers))?.version).toBe(
      0,
    );
  });
  it("lets exactly one concurrent replacement win without mixing schedules", async () => {
    const a = await tutor();
    const other = {
      ...schedule,
      timezone: "America/New_York",
      windows: [{ isoWeekday: 3, startMinute: 600, endMinute: 660 }],
    };
    const results = await Promise.all([save(a), save(a, other)]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const stored = await readOwnAvailability(world.runtime, a.headers);
    const winner = results[0].status === 200 ? schedule : other;
    expect(stored).toMatchObject({
      version: 1,
      timezone: winner.timezone,
      windows: winner.windows,
    });
    expect((await save(a)).status).toBe(409);
  });
  it("keeps profile edits from silently changing saved hours, and invalidates stale editors", async () => {
    const a = await tutor();
    await changeProfile(a, "America/New_York");
    expect((await save(a)).status).toBe(409);
    expect((await save(a, { ...schedule, version: 1 })).status).toBe(200);
    await expect(changeProfile(a, "UTC")).rejects.toThrow("Availability page");
    await changeProfile(a, "Asia/Manila");
    expect((await readOwnAvailability(world.runtime, a.headers))?.version).toBe(
      2,
    );
    expect(
      (await save(a, { ...schedule, version: 2, timezone: "America/New_York" }))
        .status,
    ).toBe(200);
    const [profile] = await world.owner.db
      .select()
      .from(tutorProfiles)
      .where(eq(tutorProfiles.id, a.profileId));
    expect(profile.timezone).toBe("America/New_York");
  });
  it("rolls back windows, zone and revision when the audit write fails", async () => {
    const a = await tutor();
    expect((await save(a)).status).toBe(200);
    // Isolated test-only fault injection; always restore the runtime grant.
    await world.owner.pool.query(
      "REVOKE INSERT ON audit_events FROM learli_app",
    );
    try {
      expect(
        (
          await save(a, {
            ...schedule,
            version: 1,
            timezone: "UTC",
            windows: [],
          })
        ).status,
      ).toBe(503);
      expect(await readOwnAvailability(world.runtime, a.headers)).toMatchObject(
        { version: 1, timezone: "Asia/Manila", windows: hours },
      );
    } finally {
      await world.owner.pool.query(
        "GRANT INSERT ON audit_events TO learli_app",
      );
    }
  });
  it("enforces database bounds, uniqueness, foreign keys and restricted runtime grants", async () => {
    const a = await tutor();
    for (const [day, start, end] of [
      [0, 540, 600],
      [8, 540, 600],
      [1, -1, 600],
      [1, 1440, 1500],
      [1, 540, 540],
      [1, 540, 1981],
    ]) {
      await expect(
        world.owner.pool.query(
          "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) VALUES($1,$2,$3,$4)",
          [a.profileId, day, start, end],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    }
    await expect(
      world.owner.pool.query(
        "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) VALUES($1,1,540,600)",
        [randomUUID()],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    expect((await save(a)).status).toBe(200);
    await expect(
      world.owner.pool.query(
        "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) VALUES($1,1,540,600)",
        [a.profileId],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      world.runtime.pool.query(
        "ALTER TABLE tutor_availability ADD COLUMN unauthorized text",
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      world.owner.pool.query(
        "UPDATE tutor_profiles SET availability_version=-1 WHERE id=$1",
        [a.profileId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("expands persisted windows with actual DST and overnight UTC instants", async () => {
    const a = await tutor();
    expect(
      (
        await save(a, {
          ...schedule,
          timezone: "America/New_York",
          windows: [{ isoWeekday: 7, startMinute: 60, endMinute: 240 }],
        })
      ).status,
    ).toBe(200);
    const intervals = await readOwnAvailabilityIntervals(
      world.runtime,
      a.headers,
      new Date("2026-03-08T00:00Z"),
      new Date("2026-03-09T00:00Z"),
    );
    expect(intervals).toEqual([
      {
        start: new Date("2026-03-08T06:00Z"),
        end: new Date("2026-03-08T08:00Z"),
      },
    ]);
    expect(
      (
        await save(a, {
          ...schedule,
          version: 1,
          windows: [{ isoWeekday: 7, startMinute: 1380, endMinute: 1500 }],
        })
      ).status,
    ).toBe(200);
    expect(
      await readOwnAvailabilityIntervals(
        world.runtime,
        a.headers,
        new Date("2026-10-11T00:00Z"),
        new Date("2026-10-12T00:00Z"),
      ),
    ).toEqual([
      {
        start: new Date("2026-10-11T15:00Z"),
        end: new Date("2026-10-11T17:00Z"),
      },
    ]);
  });
});
