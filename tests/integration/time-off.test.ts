import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  handleTimeOffRead,
  handleTimeOffSave,
} from "@/features/time-off/handler";
import {
  readOwnTimeOff,
  readTutorTimeOffIntervals,
} from "@/features/time-off/service";
import {
  readOwnAvailabilityIntervals,
  saveOwnAvailability,
} from "@/features/availability/service";
import {
  tutorAvailability,
  tutorAvailabilityExceptions,
  tutorProfiles,
  user,
  userAccess,
} from "@/lib/db/schema";
import {
  openWorld,
  closeWorld,
  createAccount,
  jsonRequest,
  type World,
} from "./support";
let world: World;
const add = {
  operation: "add",
  version: 0,
  timezone: "Asia/Manila",
  startLocal: "2026-10-13T23:00",
  endLocal: "2026-10-14T01:00",
};
async function tutor() {
  const account = await createAccount(world, ["tutor"]);
  const [profile] = await world.owner.db
    .insert(tutorProfiles)
    .values({
      userId: account.id,
      slug: `time-off-${randomUUID()}`,
      headline: "Synthetic",
      bio: "Synthetic",
      teachingBackground: "Synthetic",
      timezone: "Asia/Manila",
    })
    .returning();
  return { ...account, profileId: profile.id };
}
function save(
  account: { cookie?: string },
  body: unknown = add,
  origin?: string,
) {
  return handleTimeOffSave(
    world.runtime,
    jsonRequest(world, "/api/tutor/time-off", {
      method: "POST",
      cookie: account.cookie,
      body,
      origin,
    }),
  );
}
function read(account: { cookie?: string }) {
  return handleTimeOffRead(
    world.runtime,
    jsonRequest(world, "/api/tutor/time-off", {
      method: "GET",
      cookie: account.cookie,
    }),
  );
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
describe("owner-managed time off on real PostgreSQL", () => {
  it("adds/removes a concrete overnight interval with a private snapshot, revision and audit", async () => {
    const a = await tutor();
    expect(await readOwnTimeOff(world.runtime, a.headers)).toMatchObject({
      version: 0,
      exceptions: [],
    });
    const response = await save(a);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = await response.json();
    expect(body).toMatchObject({
      version: 1,
      exceptions: [
        {
          startAtUtc: "2026-10-13T15:00:00.000Z",
          endAtUtc: "2026-10-13T17:00:00.000Z",
        },
      ],
    });
    const result = await read(a);
    expect(result.headers.get("cache-control")).toContain("no-store");
    const snapshot = await result.json();
    expect(JSON.stringify(snapshot)).not.toContain(a.id);
    expect(JSON.stringify(snapshot)).not.toContain(a.profileId);
    expect(snapshot.schedule.exceptions).toEqual(body.exceptions);
    const removed = await save(a, {
      operation: "remove",
      version: 1,
      id: body.exceptions[0].id,
    });
    expect(removed.status).toBe(200);
    expect(await removed.json()).toMatchObject({ version: 2, exceptions: [] });
    expect(
      (
        await world.owner.pool.query(
          "SELECT 1 FROM audit_events WHERE actor_user_id=$1 AND action='tutor_time_off.updated'",
          [a.id],
        )
      ).rowCount,
    ).toBe(2);
  });
  it("denies anonymous/wrong-role/admin-only access and forged ownership; foreign removal is nondisclosing", async () => {
    expect((await save({})).status).toBe(401);
    expect((await read({})).status).toBe(401);
    for (const roles of [[], ["parent"], ["student"], ["admin"]] as const) {
      const account = await createAccount(world, [...roles]);
      expect((await save(account)).status).toBe(403);
      expect((await read(account)).status).toBe(403);
    }
    const a = await tutor(),
      b = await tutor();
    expect((await save(a, { ...add, tutorId: b.profileId })).status).toBe(400);
    const response = await save(b);
    const { exceptions } = await response.json();
    const foreign = await save(a, {
      operation: "remove",
      version: 0,
      id: exceptions[0].id,
    });
    const missing = await save(a, {
      operation: "remove",
      version: 0,
      id: randomUUID(),
    });
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
    expect(
      (await readOwnTimeOff(world.runtime, a.headers))?.exceptions,
    ).toEqual([]);
    expect(
      (await readOwnTimeOff(world.runtime, b.headers))?.exceptions,
    ).toHaveLength(1);
    expect((await readOwnTimeOff(world.runtime, a.headers))?.version).toBe(0);
  });
  it("blocks unverified/suspended accounts and suspended profiles; requires an existing profile", async () => {
    const noProfile = await createAccount(world, ["tutor"]);
    expect((await read(noProfile)).status).toBe(200);
    expect(await (await read(noProfile)).json()).toEqual({ schedule: null });
    expect((await save(noProfile)).status).toBe(409);
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
    expect((await read(a)).status).toBe(403);
    await world.owner.db
      .update(userAccess)
      .set({ status: "active" })
      .where(eq(userAccess.userId, a.id));
    await world.owner.db
      .update(tutorProfiles)
      .set({ reviewStatus: "suspended" })
      .where(eq(tutorProfiles.id, a.profileId));
    expect((await save(a)).status).toBe(409);
    expect((await readOwnTimeOff(world.runtime, a.headers))?.editable).toBe(
      false,
    );
  });
  it("refuses cross-origin, oversized, malformed, invalid range and DST gap/fold mutations without writes", async () => {
    const a = await tutor();
    expect((await save(a, add, "https://elsewhere.example")).status).toBe(403);
    for (const change of [
      { reason: "x".repeat(9000) },
      { endLocal: add.startLocal },
      { endLocal: "2026-10-13T22:00" },
      { startLocal: "2026-02-29T12:00" },
      { timezone: "EST" },
      { timezone: "America/New_York", startLocal: "2026-03-08T02:30" },
      { timezone: "America/New_York", endLocal: "2026-11-01T01:30" },
    ])
      expect((await save(a, { ...add, ...change })).status).toBe(400);
    const malformed = new Request(
      `${world.runtime.origin}/api/tutor/time-off`,
      {
        method: "POST",
        headers: {
          origin: world.runtime.origin,
          cookie: a.cookie,
          "content-type": "application/json",
        },
        body: "{",
      },
    );
    expect((await handleTimeOffSave(world.runtime, malformed)).status).toBe(
      400,
    );
    expect(await readOwnTimeOff(world.runtime, a.headers)).toMatchObject({
      version: 0,
      exceptions: [],
    });
  });
  it("rejects stale/duplicate mutations and allows exactly one concurrent schedule writer", async () => {
    const a = await tutor();
    const responses = await Promise.all([
      save(a),
      save(a, {
        ...add,
        startLocal: "2026-10-15T09:00",
        endLocal: "2026-10-15T10:00",
      }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const snapshot = await readOwnTimeOff(world.runtime, a.headers);
    expect(snapshot).toMatchObject({ version: 1 });
    expect(snapshot?.exceptions).toHaveLength(1);
    const staleRemoval = await save(a, {
      operation: "remove",
      version: 0,
      id: snapshot?.exceptions[0].id,
    });
    expect(staleRemoval.status).toBe(409);
    const b = await tutor();
    const bResponses = await Promise.all([
      save(b),
      saveOwnAvailability(world.runtime, b.headers, {
        version: 0,
        timezone: "UTC",
        windows: [{ isoWeekday: 1, startMinute: 540, endMinute: 600 }],
      }).then(
        () => 200,
        (error: unknown) => {
          expect(error).toMatchObject({ status: 409 });
          return 409;
        },
      ),
    ]);
    expect(
      bResponses.map((r) => (typeof r === "number" ? r : r.status)).sort(),
    ).toEqual([200, 409]);
    const c = await tutor();
    expect((await save(c)).status).toBe(200);
    expect((await save(c, { ...add, version: 1 })).status).toBe(409);
    expect((await readOwnTimeOff(world.runtime, c.headers))?.version).toBe(1);
  });
  it("preserves concrete UTC time off across zone changes and rejects a mismatched add zone", async () => {
    const a = await tutor();
    const response = await save(a);
    const saved = await response.json();
    await saveOwnAvailability(world.runtime, a.headers, {
      version: 1,
      timezone: "America/New_York",
      windows: [],
    });
    const after = await readOwnTimeOff(world.runtime, a.headers);
    expect(after).toMatchObject({
      version: 2,
      timezone: "America/New_York",
      exceptions: saved.exceptions,
    });
    expect((await save(a, { ...add, version: 2 })).status).toBe(409);
    expect(
      (
        await save(a, {
          operation: "remove",
          version: 1,
          id: saved.exceptions[0].id,
        })
      ).status,
    ).toBe(409);
    expect((await readOwnTimeOff(world.runtime, a.headers))?.version).toBe(2);
  });
  it("suppresses overlapping candidate intervals without deleting recurring windows, and restores after removal", async () => {
    const a = await tutor();
    await saveOwnAvailability(world.runtime, a.headers, {
      version: 0,
      timezone: "Asia/Manila",
      windows: [{ isoWeekday: 2, startMinute: 1320, endMinute: 1620 }],
    });
    const response = await save(a, { ...add, version: 1 });
    const saved = await response.json();
    const from = new Date("2026-10-13T00:00Z"),
      to = new Date("2026-10-14T00:00Z");
    expect(
      await readOwnAvailabilityIntervals(world.runtime, a.headers, from, to),
    ).toEqual([
      {
        start: new Date("2026-10-13T14:00Z"),
        end: new Date("2026-10-13T15:00Z"),
      },
      {
        start: new Date("2026-10-13T17:00Z"),
        end: new Date("2026-10-13T19:00Z"),
      },
    ]);
    expect(
      await readTutorTimeOffIntervals(
        world.runtime.db,
        a.profileId,
        new Date("2026-10-13T17:00Z"),
        new Date("2026-10-13T18:00Z"),
      ),
    ).toEqual([]);
    expect(
      await readTutorTimeOffIntervals(
        world.runtime.db,
        a.profileId,
        new Date("2026-10-13T14:00Z"),
        new Date("2026-10-13T15:00Z"),
      ),
    ).toEqual([]);
    expect(
      await readTutorTimeOffIntervals(world.runtime.db, a.profileId, from, to),
    ).toEqual([
      {
        start: new Date("2026-10-13T15:00Z"),
        end: new Date("2026-10-13T17:00Z"),
      },
    ]);
    expect(
      await world.owner.db
        .select()
        .from(tutorAvailability)
        .where(eq(tutorAvailability.tutorId, a.profileId)),
    ).toHaveLength(1);
    expect(
      (
        await save(a, {
          operation: "remove",
          version: 2,
          id: saved.exceptions[0].id,
        })
      ).status,
    ).toBe(200);
    expect(
      await readOwnAvailabilityIntervals(world.runtime, a.headers, from, to),
    ).toEqual([
      {
        start: new Date("2026-10-13T14:00Z"),
        end: new Date("2026-10-13T19:00Z"),
      },
    ]);
  });
  it("persists multi-day/fold-interior intervals and union suppression with actual UTC timestamps", async () => {
    const a = await tutor();
    await saveOwnAvailability(world.runtime, a.headers, {
      version: 0,
      timezone: "America/New_York",
      windows: [{ isoWeekday: 7, startMinute: 0, endMinute: 240 }],
    });
    const response = await save(a, {
      ...add,
      version: 1,
      timezone: "America/New_York",
      startLocal: "2026-11-01T00:30",
      endLocal: "2026-11-01T02:30",
    });
    expect(response.status).toBe(200);
    expect((await response.json()).exceptions).toMatchObject([
      {
        startAtUtc: "2026-11-01T04:30:00.000Z",
        endAtUtc: "2026-11-01T07:30:00.000Z",
      },
    ]);
    expect(
      (
        await save(a, {
          ...add,
          version: 2,
          timezone: "America/New_York",
          startLocal: "2026-10-31T12:00",
          endLocal: "2026-11-02T12:00",
        })
      ).status,
    ).toBe(200);
    expect(
      await readOwnAvailabilityIntervals(
        world.runtime,
        a.headers,
        new Date("2026-11-01T00:00Z"),
        new Date("2026-11-02T00:00Z"),
      ),
    ).toEqual([]);
  });
  it("rolls back insert/delete and version when audit fails", async () => {
    const a = await tutor();
    await world.owner.pool.query(
      "REVOKE INSERT ON audit_events FROM learli_app",
    );
    try {
      expect((await save(a)).status).toBe(503);
      expect(await readOwnTimeOff(world.runtime, a.headers)).toMatchObject({
        version: 0,
        exceptions: [],
      });
    } finally {
      await world.owner.pool.query(
        "GRANT INSERT ON audit_events TO learli_app",
      );
    }
    const response = await save(a);
    const saved = await response.json();
    await world.owner.pool.query(
      "REVOKE INSERT ON audit_events FROM learli_app",
    );
    try {
      expect(
        (
          await save(a, {
            operation: "remove",
            version: 1,
            id: saved.exceptions[0].id,
          })
        ).status,
      ).toBe(503);
      expect(await readOwnTimeOff(world.runtime, a.headers)).toMatchObject({
        version: 1,
        exceptions: saved.exceptions,
      });
    } finally {
      await world.owner.pool.query(
        "GRANT INSERT ON audit_events TO learli_app",
      );
    }
  });
  it("enforces database interval/FK/duplicate constraints and least-privilege runtime grants", async () => {
    const a = await tutor();
    for (const [start, end] of [
      ["2026-10-13T15:00Z", "2026-10-13T15:00Z"],
      ["2026-10-13T17:00Z", "2026-10-13T15:00Z"],
      ["2026-10-13T15:00Z", "infinity"],
      ["-infinity", "2026-10-13T15:00Z"],
    ])
      await expect(
        world.owner.pool.query(
          "INSERT INTO tutor_availability_exceptions(tutor_id,start_at_utc,end_at_utc) VALUES($1,$2,$3)",
          [a.profileId, start, end],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    await expect(
      world.owner.pool.query(
        "INSERT INTO tutor_availability_exceptions(tutor_id,start_at_utc,end_at_utc) VALUES($1,'2026-10-13T15:00Z','2026-10-13T17:00Z')",
        [randomUUID()],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    expect((await save(a)).status).toBe(200);
    await expect(
      world.owner.pool.query(
        "INSERT INTO tutor_availability_exceptions(tutor_id,start_at_utc,end_at_utc) VALUES($1,'2026-10-13T15:00Z','2026-10-13T17:00Z')",
        [a.profileId],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      world.runtime.pool.query(
        "UPDATE tutor_availability_exceptions SET end_at_utc=end_at_utc+interval '1 hour'",
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      world.runtime.pool.query(
        "ALTER TABLE tutor_availability_exceptions ADD COLUMN unauthorized text",
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("bounds owner growth and repository queries without inventing a booking horizon", async () => {
    const a = await tutor();
    await world.owner.db.insert(tutorAvailabilityExceptions).values(
      Array.from({ length: 128 }, (_, i) => ({
        tutorId: a.profileId,
        startAtUtc: new Date(Date.UTC(2027, 0, i + 1)),
        endAtUtc: new Date(Date.UTC(2027, 0, i + 1, 1)),
      })),
    );
    expect((await save(a)).status).toBe(409);
    expect((await readOwnTimeOff(world.runtime, a.headers))?.version).toBe(0);
    await expect(
      readTutorTimeOffIntervals(
        world.runtime.db,
        a.profileId,
        new Date("bad"),
        new Date(),
      ),
    ).rejects.toThrow(RangeError);
    await expect(
      readTutorTimeOffIntervals(
        world.runtime.db,
        a.profileId,
        new Date("2026-01-01Z"),
        new Date("2028-01-01Z"),
      ),
    ).rejects.toThrow(RangeError);
  });
});
