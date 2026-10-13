import { listLearnerGroups } from "@/features/learners/composition";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { handleLearnerRequest } from "@/features/learners/handler";
import {
  listMyLearners,
  readMyLearner,
  updateMyLearner,
} from "@/features/learners/service";
import {
  guardianLearnerLinks,
  learnerProfiles,
} from "@/lib/db/schema/learners";
import { user, userAccess, userRoles } from "@/lib/db/schema";
import {
  createAccount,
  openWorld,
  closeWorld,
  jsonRequest,
  type World,
  type TestAccount,
} from "./support";

let world: World;
let parent: TestAccount,
  otherParent: TestAccount,
  student: TestAccount,
  otherStudent: TestAccount,
  tutor: TestAccount,
  admin: TestAccount,
  roleless: TestAccount;
let learnerId: string, otherId: string, selfId: string;
const input = {
  displayName: "Synthetic edited learner",
  level: "middle_school",
  timezone: "America/New_York",
};
async function provision(account: TestAccount, self = false) {
  const [profile] = await world.owner.db
    .insert(learnerProfiles)
    .values({
      fixtureKey: randomUUID(),
      source: "local_fixture",
      management: self ? "self" : "guardian",
      userId: self ? account.id : null,
      displayName: "Synthetic private learner",
      level: self ? "college_support" : "elementary",
      timezone: "Asia/Manila",
    })
    .returning();
  if (!self)
    await world.owner.db.insert(guardianLearnerLinks).values({
      guardianUserId: account.id,
      learnerId: profile.id,
      source: "local_fixture",
      status: "authorized",
    });
  return profile.id;
}
function request(
  account?: TestAccount,
  id?: string,
  body?: unknown,
  origin?: string,
) {
  return handleLearnerRequest(
    world.runtime,
    jsonRequest(world, `/api/learners${id ? `/${id}` : ""}`, {
      method: body === undefined ? "GET" : "PATCH",
      cookie: account?.cookie,
      body,
      origin,
    }),
    id,
  );
}
beforeAll(async () => {
  world = openWorld();
  parent = await createAccount(world, ["parent"]);
  otherParent = await createAccount(world, ["parent"]);
  student = await createAccount(world, ["student"]);
  otherStudent = await createAccount(world, ["student"]);
  tutor = await createAccount(world, ["tutor"]);
  admin = await createAccount(world, ["admin"]);
  roleless = await createAccount(world);
  learnerId = await provision(parent);
  otherId = await provision(otherParent);
  selfId = await provision(student, true);
}, 30000);
afterAll(() => closeWorld(world));

describe("local learner ownership against PostgreSQL", () => {
  it("lists only authorized learners and edits minimum fields", async () => {
    expect(
      (await listMyLearners(world.runtime, parent.headers)).map(
        (row) => row.id,
      ),
    ).toEqual([learnerId]);
    const result = await updateMyLearner(
      world.runtime,
      parent.headers,
      learnerId,
      input,
    );
    expect(result).toMatchObject(input);
    expect(Object.keys(result).sort()).toEqual([
      "displayName",
      "id",
      "level",
      "management",
      "timezone",
    ]);
    expect(
      (await readMyLearner(world.runtime, parent.headers, learnerId))
        .displayName,
    ).toBe(input.displayName);
  });
  it("denies cross-parent reads/writes identically to nonexistent and malformed IDs", async () => {
    for (const id of [otherId, randomUUID(), "bad-id"]) {
      const read = await request(parent, id);
      const write = await request(parent, id, input);
      expect(read.status).toBe(404);
      expect(write.status).toBe(404);
      expect(await read.json()).toEqual({
        message: "This account is not available.",
      });
    }
    expect(
      (await readMyLearner(world.runtime, otherParent.headers, otherId))
        .displayName,
    ).toBe("Synthetic private learner");
  });
  it("self-managed college learner operates without a guardian", async () => {
    expect(
      await world.owner.db
        .select()
        .from(guardianLearnerLinks)
        .where(eq(guardianLearnerLinks.learnerId, selfId)),
    ).toEqual([]);
    expect(
      (await request(student, selfId, { ...input, level: "college_support" }))
        .status,
    ).toBe(200);
    expect((await request(student, selfId, input)).status).toBe(400);
    expect((await request(otherStudent, selfId)).status).toBe(404);
    expect((await request(parent, selfId)).status).toBe(404);
    expect((await request(student, learnerId)).status).toBe(404);
  });
  it("rejects forged self/guardian/eligibility/role fields", async () => {
    for (const key of [
      "userId",
      "guardianUserId",
      "learnerId",
      "management",
      "status",
      "source",
      "role",
    ])
      expect(
        (await request(parent, learnerId, { ...input, [key]: otherParent.id }))
          .status,
      ).toBe(400);
    const create = await handleLearnerRequest(
      world.runtime,
      jsonRequest(world, "/api/learners", {
        method: "POST",
        cookie: parent.cookie,
        body: { ...input, learnerId: otherId },
      }),
    );
    expect(create.status).toBe(400);
  });
  it("denies anonymous, wrong-role, and admin bypasses", async () => {
    expect((await request(undefined, learnerId)).status).toBe(401);
    for (const account of [tutor, admin, roleless]) {
      await expect(
        listLearnerGroups(world.runtime, account.headers),
      ).rejects.toMatchObject({ status: 403 });
      expect((await request(account)).status).toBe(403);
      expect((await request(account, learnerId, input)).status).toBe(403);
    }
  });
  it("returns an honest empty list for a parent with no links", async () => {
    const empty = await createAccount(world, ["parent"]);
    expect(await listMyLearners(world.runtime, empty.headers)).toEqual([]);
  });
  it("rechecks suspended and unverified identities", async () => {
    await world.owner.db
      .update(userAccess)
      .set({ status: "suspended" })
      .where(eq(userAccess.userId, parent.id));
    expect((await request(parent, learnerId)).status).toBe(403);
    expect((await request(parent, learnerId, input)).status).toBe(403);
    await world.owner.db
      .update(userAccess)
      .set({ status: "active" })
      .where(eq(userAccess.userId, parent.id));
    await world.owner.db
      .update(user)
      .set({ emailVerified: false })
      .where(eq(user.id, parent.id));
    expect((await request(parent, learnerId)).status).toBe(403);
    await world.owner.db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.id, parent.id));
  });
  it("revoked links, inactive learners and removed roles immediately lose access", async () => {
    await world.owner.db
      .update(guardianLearnerLinks)
      .set({ status: "revoked" })
      .where(eq(guardianLearnerLinks.learnerId, learnerId));
    expect(await listMyLearners(world.runtime, parent.headers)).toEqual([]);
    expect((await request(parent, learnerId, input)).status).toBe(404);
    await world.owner.db
      .update(guardianLearnerLinks)
      .set({ status: "authorized" })
      .where(eq(guardianLearnerLinks.learnerId, learnerId));
    await world.owner.db
      .update(learnerProfiles)
      .set({ status: "inactive" })
      .where(eq(learnerProfiles.id, learnerId));
    expect((await request(parent, learnerId)).status).toBe(404);
    await world.owner.db
      .update(learnerProfiles)
      .set({ status: "active" })
      .where(eq(learnerProfiles.id, learnerId));
    await world.owner.db
      .delete(userRoles)
      .where(eq(userRoles.userId, parent.id));
    expect((await request(parent, learnerId, input)).status).toBe(403);
    await world.owner.db
      .insert(userRoles)
      .values({ userId: parent.id, role: "parent" });
  });
  it("serves private no-store responses including denials and refuses cross-origin writes", async () => {
    for (const response of [
      await request(parent, learnerId),
      await request(otherParent, learnerId),
    ]) {
      expect(response.headers.get("cache-control")).toContain(
        "private, no-store",
      );
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    }
    expect(
      (await request(parent, learnerId, input, "https://untrusted.test"))
        .status,
    ).toBe(403);
    expect(
      (
        await handleLearnerRequest(
          null,
          jsonRequest(world, "/api/learners", { method: "GET" }),
        )
      ).status,
    ).toBe(503);
    await expect(
      listMyLearners(
        { ...world.runtime, environment: "production" as never },
        parent.headers,
      ),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("validates names, levels, time zones and malformed requests", async () => {
    for (const values of [
      { ...input, displayName: " " },
      { ...input, displayName: "x".repeat(81) },
      { ...input, level: "unknown" },
      { ...input, timezone: "Mars/Olympus" },
    ])
      expect((await request(parent, learnerId, values)).status).toBe(400);
    const malformed = new Request(
      `${world.runtime.origin}/api/learners/${learnerId}`,
      {
        method: "PATCH",
        headers: {
          origin: world.runtime.origin,
          cookie: parent.cookie,
          "content-type": "application/json",
        },
        body: "{",
      },
    );
    expect(
      (await handleLearnerRequest(world.runtime, malformed, learnerId)).status,
    ).toBe(400);
  });
  it("database rejects duplicate self profiles, invalid fields and guardian links to self profiles", async () => {
    const base = {
      fixtureKey: randomUUID(),
      source: "local_fixture" as const,
      management: "self" as const,
      userId: student.id,
      displayName: "Synthetic",
      level: "college_support" as const,
      timezone: "UTC",
    };
    await expect(
      world.owner.db.insert(learnerProfiles).values(base),
    ).rejects.toThrow();
    for (const values of [
      { ...base, userId: otherStudent.id, level: "elementary" as const },
      { ...base, management: "guardian" as const },
      {
        ...base,
        management: "guardian" as const,
        userId: null,
        displayName: " ",
      },
      { ...base, userId: randomUUID() },
    ])
      await expect(
        world.owner.db.insert(learnerProfiles).values(values),
      ).rejects.toThrow();
    await expect(
      world.owner.db.insert(guardianLearnerLinks).values({
        guardianUserId: parent.id,
        learnerId: selfId,
        source: "local_fixture",
        status: "authorized",
      }),
    ).rejects.toThrow();
    await expect(
      world.owner.db.insert(guardianLearnerLinks).values({
        guardianUserId: parent.id,
        learnerId: learnerId,
        source: "local_fixture",
        status: "authorized",
      }),
    ).rejects.toThrow();
    await expect(
      world.owner.pool.query(
        "UPDATE guardian_learner_links SET status = 'pending' WHERE learner_id = $1",
        [learnerId],
      ),
    ).rejects.toThrow();
  });
  it("runtime cannot insert, delete, transfer, authorize or reactivate learner records", async () => {
    for (const query of [
      "DELETE FROM learner_profiles WHERE id = $1",
      "UPDATE learner_profiles SET user_id = 'forged' WHERE id = $1",
      "UPDATE learner_profiles SET status = 'active' WHERE id = $1",
      "UPDATE learner_profiles SET source = 'local_fixture' WHERE id = $1",
      "UPDATE learner_profiles SET management = 'self' WHERE id = $1",
      "DELETE FROM guardian_learner_links WHERE learner_id = $1",
      "UPDATE guardian_learner_links SET status = 'authorized' WHERE learner_id = $1",
    ])
      await expect(
        world.runtime.pool.query(query, [learnerId]),
      ).rejects.toMatchObject({ code: "42501" });
    await expect(
      world.runtime.pool.query(
        "INSERT INTO learner_profiles (id) VALUES ($1)",
        [randomUUID()],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      world.runtime.pool.query(
        "INSERT INTO guardian_learner_links (guardian_user_id, learner_id, source, status) VALUES ($1,$2,'local_fixture','authorized')",
        [otherParent.id, learnerId],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
