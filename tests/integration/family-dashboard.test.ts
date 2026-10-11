import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFamilyDashboard } from "@/features/family-dashboard/read";
import { AccessError } from "@/lib/permissions/access";
import {
  openWorld,
  closeWorld,
  createAccount,
  type World,
  type TestAccount,
} from "./support";
import {
  familyLearner,
  familyReservation,
  familyTutor,
} from "../support/family-fixtures";

let world: World, multi: TestAccount, other: TestAccount, wrong: TestAccount;
let child: string,
  second: string,
  self: string,
  foreign: string,
  reserved: string,
  expired: string;
beforeAll(async () => {
  world = openWorld();
  await world.owner.pool.query("UPDATE rate_limit SET count=0");
  multi = await createAccount(world, ["student", "parent"]);
  other = await createAccount(world, ["parent"]);
  wrong = await createAccount(world, ["tutor"]);
  child = await familyLearner(
    world.owner.pool,
    multi.id,
    "guardian",
    "Synthetic current family learner",
  );
  second = await familyLearner(
    world.owner.pool,
    multi.id,
    "guardian",
    "Synthetic second family learner",
  );
  self = await familyLearner(
    world.owner.pool,
    multi.id,
    "self",
    "Synthetic self family learner",
  );
  foreign = await familyLearner(
    world.owner.pool,
    other.id,
    "guardian",
    "Synthetic foreign family learner",
  );
  const tutor = await familyTutor(world.owner.pool);
  reserved = await familyReservation(world.owner.pool, {
    actorId: multi.id,
    learnerId: child,
    tutorId: tutor,
  });
  expired = await familyReservation(world.owner.pool, {
    actorId: multi.id,
    learnerId: second,
    tutorId: tutor,
    expired: true,
    startMinutes: 360,
  });
  await familyReservation(world.owner.pool, {
    actorId: multi.id,
    learnerId: self,
    tutorId: tutor,
    startMinutes: 540,
  });
  await familyReservation(world.owner.pool, {
    actorId: other.id,
    learnerId: foreign,
    tutorId: tutor,
    startMinutes: 720,
  });
}, 30_000);
afterAll(() => closeWorld(world));

describe("family dashboard real authorized provider wiring", () => {
  it("separates self and guardian scopes on a multi-role account", async () => {
    const parent = await readFamilyDashboard(
      world.runtime,
      multi.headers,
      "parent",
      {},
    );
    expect(parent.learners.map((row) => row.id).sort()).toEqual(
      [child, second].sort(),
    );
    expect(parent.active.map((row) => row.id)).toEqual([reserved]);
    expect(parent.history.map((row) => row.id)).toEqual([expired]);
    const student = await readFamilyDashboard(
      world.runtime,
      multi.headers,
      "student",
      {},
    );
    expect(student.learners.map((row) => row.id)).toEqual([self]);
    expect(student.active).toHaveLength(1);
    expect(student.active[0].learner.id).toBe(self);
  });
  it("filters one current guardian learner, retains expiry history and performs no writes", async () => {
    const before = await world.owner.pool.query(
      "SELECT state,(SELECT count(*)::int FROM booking_events WHERE booking_id=$1) AS events FROM bookings WHERE id=$1",
      [expired],
    );
    const page = await readFamilyDashboard(
      world.runtime,
      multi.headers,
      "parent",
      { learner: second },
    );
    expect(page.selectedLearner?.id).toBe(second);
    expect(page.active).toHaveLength(0);
    expect(page.history.map((row) => row.id)).toEqual([expired]);
    expect(page.history[0].state).toBe("demo_expired");
    const after = await world.owner.pool.query(
      "SELECT state,(SELECT count(*)::int FROM booking_events WHERE booking_id=$1) AS events FROM bookings WHERE id=$1",
      [expired],
    );
    expect(after.rows).toEqual(before.rows);
  });
  it("rejects foreign, self-in-guardian, guardian-in-student and malformed selection", async () => {
    for (const [workspace, learner] of [
      ["parent", foreign],
      ["parent", self],
      ["student", child],
      ["parent", "invalid"],
    ] as const)
      await expect(
        readFamilyDashboard(world.runtime, multi.headers, workspace, {
          learner,
        }),
      ).rejects.toBeInstanceOf(AccessError);
    await expect(
      readFamilyDashboard(world.runtime, multi.headers, "parent", {
        learner: [child, foreign],
      }),
    ).rejects.toBeInstanceOf(AccessError);
  });
  it("uses current viewer timezone, never a learner zone", async () => {
    await world.owner.pool.query('UPDATE "user" SET timezone=$2 WHERE id=$1', [
      multi.id,
      "America/New_York",
    ]);
    const page = await readFamilyDashboard(
      world.runtime,
      multi.headers,
      "parent",
      {},
    );
    expect(page.checkedAt.zone).toContain("Eastern");
    expect(page.active[0].when.zone).toContain("Eastern");
    expect(page.active[0].when.zone).not.toContain("Philippine");
  });
  it("keeps ongoing reservations in active and paginates expired future-time history", async () => {
    const tutor = await familyTutor(world.owner.pool);
    const ongoing = await familyReservation(world.owner.pool, {
      actorId: multi.id,
      learnerId: child,
      tutorId: tutor,
      startMinutes: -30,
    });
    for (let index = 0; index < 21; index++)
      await familyReservation(world.owner.pool, {
        actorId: multi.id,
        learnerId: second,
        tutorId: tutor,
        expired: true,
        startMinutes: 1440 + index * 120,
      });
    const active = await readFamilyDashboard(
      world.runtime,
      multi.headers,
      "parent",
      {},
    );
    expect(active.active[0].id).toBe(ongoing);
    expect(active.active[0].startAtUtc < active.checkedAt.startAtUtc).toBe(
      true,
    );
    expect(active.history).toHaveLength(20);
    expect(active.historyHasNext).toBe(true);
    const history = await readFamilyDashboard(
      world.runtime,
      multi.headers,
      "parent",
      { learner: second, historyPage: "2" },
    );
    expect(history.history).toHaveLength(2);
    expect(history.historyHasNext).toBe(false);
    expect(history.query.learner).toBe(second);
  });
  it("does not leak revoked or archived learners and rejects their direct filters", async () => {
    await world.owner.pool.query(
      "UPDATE guardian_learner_links SET status='revoked' WHERE learner_id=$1",
      [child],
    );
    await world.owner.pool.query(
      "UPDATE learner_profiles SET status='inactive' WHERE id=$1",
      [second],
    );
    const page = await readFamilyDashboard(
      world.runtime,
      multi.headers,
      "parent",
      {},
    );
    expect(page.learners).toHaveLength(0);
    expect(page.active).toHaveLength(0);
    expect(page.history).toHaveLength(0);
    await expect(
      readFamilyDashboard(world.runtime, multi.headers, "parent", {
        learner: child,
      }),
    ).rejects.toBeInstanceOf(AccessError);
    await expect(
      readFamilyDashboard(world.runtime, multi.headers, "parent", {
        learner: second,
      }),
    ).rejects.toBeInstanceOf(AccessError);
  });
  it("denies anonymous, wrong-role, suspended, unverified and revoked-role actors", async () => {
    await expect(
      readFamilyDashboard(world.runtime, new Headers(), "student", {}),
    ).rejects.toBeInstanceOf(AccessError);
    await expect(
      readFamilyDashboard(world.runtime, wrong.headers, "parent", {}),
    ).rejects.toBeInstanceOf(AccessError);
    await world.owner.pool.query(
      "UPDATE user_access SET status='suspended' WHERE user_id=$1",
      [other.id],
    );
    await expect(
      readFamilyDashboard(world.runtime, other.headers, "parent", {}),
    ).rejects.toBeInstanceOf(AccessError);
    await world.owner.pool.query(
      "UPDATE user_access SET status='active' WHERE user_id=$1",
      [other.id],
    );
    await world.owner.pool.query(
      'UPDATE "user" SET email_verified=false WHERE id=$1',
      [other.id],
    );
    await expect(
      readFamilyDashboard(world.runtime, other.headers, "parent", {}),
    ).rejects.toBeInstanceOf(AccessError);
    await world.owner.pool.query(
      'UPDATE "user" SET email_verified=true WHERE id=$1',
      [other.id],
    );
    await world.owner.pool.query("DELETE FROM user_roles WHERE user_id=$1", [
      other.id,
    ]);
    await expect(
      readFamilyDashboard(world.runtime, other.headers, "parent", {}),
    ).rejects.toBeInstanceOf(AccessError);
  });
});
