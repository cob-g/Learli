import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createMyLearner,
  listMyLearners,
  readLearnerCreationContext,
} from "@/features/learners/service";
import { handleLearnerRequest } from "@/features/learners/handler";
import { loadDemoBookingOptions } from "@/features/bookings/service";
import {
  openWorld,
  closeWorld,
  createAccount,
  jsonRequest,
  type World,
  type TestAccount,
} from "./support";
let world: World;
let parent: TestAccount, other: TestAccount, student: TestAccount;
const base = {
  displayName: "Synthetic created learner",
  level: "elementary",
  timezone: "Asia/Manila",
  management: "guardian",
};
const values = (extra = {}) => ({ ...base, requestId: randomUUID(), ...extra });
const create = (account: TestAccount, input: unknown) =>
  createMyLearner(world.runtime, account.headers, input);
const request = (
  account: TestAccount | undefined,
  input: unknown,
  origin?: string,
) =>
  handleLearnerRequest(
    world.runtime,
    jsonRequest(world, "/api/learners", {
      body: input,
      cookie: account?.cookie,
      origin,
    }),
  );
beforeAll(async () => {
  world = openWorld();
  parent = await createAccount(world, ["parent"]);
  other = await createAccount(world, ["parent"]);
  student = await createAccount(world, ["student"]);
}, 30000);
afterAll(() => closeWorld(world));
async function counts(actor: string) {
  return (
    await world.owner.pool.query(
      `SELECT
    (SELECT count(*)::int FROM learner_creation_events WHERE actor_user_id=$1) AS events,
    (SELECT count(*)::int FROM guardian_learner_links WHERE guardian_user_id=$1) AS links`,
      [actor],
    )
  ).rows[0];
}
async function waited(
  actor: TestAccount,
  change: (client: PoolClient) => Promise<unknown>,
) {
  const locker = await world.owner.pool.connect();
  try {
    await locker.query("BEGIN");
    await locker.query('SELECT id FROM "user" WHERE id=$1 FOR NO KEY UPDATE', [
      actor.id,
    ]);
    const attempt = create(actor, values()).then(
      (result) => ({ result, error: undefined }),
      (error: unknown) => ({ result: undefined, error }),
    );
    let observed = false;
    for (let i = 0; i < 200; i++) {
      const result = await world.owner.pool.query(
        "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND usename='learli_app' AND wait_event_type='Lock' AND query LIKE '%create_local_learner%' AND pid<>pg_backend_pid()",
      );
      if (result.rows[0].count > 0) {
        observed = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(observed).toBe(true);
    await change(locker);
    await locker.query("COMMIT");
    const outcome = await attempt;
    expect(outcome.result).toBeUndefined();
    expect(outcome.error).toMatchObject({ status: 403 });
    expect(await counts(actor.id)).toEqual({ events: 0, links: 0 });
  } finally {
    await locker.query("ROLLBACK");
    locker.release();
  }
}
describe("local synthetic creation against PostgreSQL", () => {
  it("atomically creates parent-owned minimum profile/link/origin and preserves booking interface", async () => {
    const profile = await create(parent, values());
    expect(Object.keys(profile).sort()).toEqual([
      "displayName",
      "grade",
      "id",
      "level",
      "management",
      "timezone",
    ]);
    expect(profile).toMatchObject({
      displayName: base.displayName,
      level: base.level,
      timezone: base.timezone,
      management: "guardian",
    });
    const origin = (
      await world.owner.pool.query(
        "SELECT e.*, l.source, g.status FROM learner_creation_events e JOIN learner_profiles l ON l.id=e.learner_id JOIN guardian_learner_links g ON g.learner_id=l.id WHERE e.learner_id=$1",
        [profile.id],
      )
    ).rows[0];
    expect(origin).toMatchObject({
      actor_user_id: parent.id,
      origin: "local_creation",
      source: "local_fixture",
      status: "authorized",
    });
    expect(origin.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.keys(origin)).not.toContain("display_name");
    expect(
      (
        await loadDemoBookingOptions(world.runtime, parent.headers)
      ).learners.map((l) => l.id),
    ).toContain(profile.id);
    expect(
      (await listMyLearners(world.runtime, other.headers)).map((l) => l.id),
    ).not.toContain(profile.id);
  });
  it("concurrent same-key requests replay one learner and one receipt", async () => {
    const actor = await createAccount(world, ["parent"]);
    const input = values();
    const profiles = await Promise.all([
      create(actor, input),
      create(actor, input),
      create(actor, input),
    ]);
    expect(new Set(profiles.map((p) => p.id)).size).toBe(1);
    expect(await counts(actor.id)).toEqual({ events: 1, links: 1 });
    expect(
      (await create(actor, { ...input, displayName: ` ${base.displayName} ` }))
        .id,
    ).toBe(profiles[0].id);
    await expect(
      create(actor, { ...input, level: "middle_school" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await counts(actor.id)).toEqual({ events: 1, links: 1 });
  });
  it("distinct parent keys preserve identical sibling fields and cross-actor retry identity", async () => {
    const actor = await createAccount(world, ["parent"]);
    const input = values();
    const [first, second, foreign] = await Promise.all([
      create(actor, input),
      create(actor, values()),
      create(other, input),
    ]);
    expect(new Set([first.id, second.id, foreign.id]).size).toBe(3);
    expect(await counts(actor.id)).toEqual({ events: 2, links: 2 });
    expect(
      (await listMyLearners(world.runtime, actor.headers)).map((l) => l.id),
    ).not.toContain(foreign.id);
  });
  it("creates one own College Support profile without guardian and detects concurrent distinct keys", async () => {
    const own = values({ management: "self", level: "college_support" });
    const profile = await create(student, own);
    expect(profile.management).toBe("self");
    expect(await counts(student.id)).toEqual({ events: 1, links: 0 });
    expect((await create(student, own)).id).toBe(profile.id);
    expect(
      (await readLearnerCreationContext(world.runtime, student.headers)).modes,
    ).toEqual([]);
    await expect(
      create(student, values({ management: "self", level: "college_support" })),
    ).rejects.toMatchObject({ status: 409 });
    const fresh = await createAccount(world, ["student"]);
    const results = await Promise.allSettled([
      create(fresh, values({ management: "self", level: "college_support" })),
      create(fresh, values({ management: "self", level: "college_support" })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await counts(fresh.id)).toEqual({ events: 1, links: 0 });
  });
  it("keeps parent and self choices tied to current trusted multi-role authority", async () => {
    const actor = await createAccount(world, ["parent", "student"]);
    expect(
      (await readLearnerCreationContext(world.runtime, actor.headers)).modes,
    ).toEqual(["guardian", "self"]);
    await create(
      actor,
      values({ management: "self", level: "college_support" }),
    );
    await create(actor, values());
    expect(
      (await readLearnerCreationContext(world.runtime, actor.headers)).modes,
    ).toEqual(["guardian"]);
    expect(await counts(actor.id)).toEqual({ events: 2, links: 1 });
  });
  it("denies arbitrary link/owner/source/role/consent/private-field injection", async () => {
    for (const key of [
      "learnerId",
      "userId",
      "guardianUserId",
      "source",
      "status",
      "role",
      "consent",
      "dateOfBirth",
      "school",
      "address",
      "origin",
      "fingerprint",
    ])
      expect(
        (await request(parent, { ...values(), [key]: other.id })).status,
      ).toBe(400);
    expect(
      (
        await request(
          parent,
          values({ management: "self", level: "college_support" }),
        )
      ).status,
    ).toBe(403);
    expect((await request(student, values())).status).toBe(403);
    expect(
      (await request(student, values({ management: "self" }))).status,
    ).toBe(400);
    expect((await request(parent, values({ requestId: "bad" }))).status).toBe(
      400,
    );
  });
  it("validates names/levels/zones and denies origin/anonymous/wrong-role/local gates", async () => {
    for (const change of [
      { displayName: " " },
      { displayName: "x".repeat(81) },
      { level: "bad" },
      { timezone: "Mars/Olympus" },
      { timezone: "Etc/GMT+8" },
    ])
      expect((await request(parent, values(change))).status).toBe(400);
    expect((await request(undefined, values())).status).toBe(401);
    for (const roles of [[], ["tutor"] as const, ["admin"] as const]) {
      const actor = await createAccount(world, [...roles]);
      expect((await request(actor, values())).status).toBe(403);
    }
    expect((await request(parent, values(), "https://other.test")).status).toBe(
      403,
    );
    await expect(
      createMyLearner(
        { ...world.runtime, environment: "production" as never },
        parent.headers,
        values(),
      ),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      createMyLearner(
        { ...world.runtime, origin: "https://learli.test" },
        parent.headers,
        values(),
      ),
    ).rejects.toMatchObject({ status: 503 });
    const response = await request(parent, values());
    expect(response.headers.get("cache-control")).toContain(
      "private, no-store",
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("denies non-.test identities even when current roles are provisioned", async () => {
    const actor = await createAccount(world, ["parent"]);
    await world.owner.pool.query('UPDATE "user" SET email=$2 WHERE id=$1', [
      actor.id,
      `synthetic-${randomUUID()}@example.invalid`,
    ]);
    expect((await request(actor, values())).status).toBe(403);
    expect(await counts(actor.id)).toEqual({ events: 0, links: 0 });
  });
  it("stale replay never restores revoked links or inactive profiles", async () => {
    const actor = await createAccount(world, ["parent"]),
      input = values();
    const profile = await create(actor, input);
    await world.owner.pool.query(
      "UPDATE guardian_learner_links SET status='revoked' WHERE learner_id=$1",
      [profile.id],
    );
    expect((await request(actor, input)).status).toBe(404);
    await world.owner.pool.query(
      "UPDATE guardian_learner_links SET status='authorized' WHERE learner_id=$1",
      [profile.id],
    );
    await world.owner.pool.query(
      "UPDATE learner_profiles SET status='inactive' WHERE id=$1",
      [profile.id],
    );
    expect((await request(actor, input)).status).toBe(404);
    expect(await counts(actor.id)).toEqual({ events: 1, links: 1 });
  });
  it("serializes capacity, excludes owner fixtures, and never charges retries", async () => {
    const actor = await createAccount(world, ["parent"]);
    const ownerFixture = await world.owner.pool.query(
      "INSERT INTO learner_profiles(fixture_key,source,management,display_name,level,timezone) VALUES($1,'local_fixture','guardian','Synthetic owner fixture','elementary','UTC') RETURNING id",
      [randomUUID()],
    );
    await world.owner.pool.query(
      "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
      [actor.id, ownerFixture.rows[0].id],
    );
    let first: ReturnType<typeof values> | undefined;
    for (let i = 0; i < 19; i++) {
      const input = values();
      first ??= input;
      await create(actor, input);
    }
    const outcomes = await Promise.allSettled([
      create(actor, values()),
      create(actor, values()),
    ]);
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await counts(actor.id)).toEqual({ events: 20, links: 21 });
    await create(actor, first);
    expect(await counts(actor.id)).toEqual({ events: 20, links: 21 });
  });
  it.each(["role", "session", "access", "verification"])(
    "rechecks %s revocation committed while waiting for actor lock",
    async (kind) => {
      const actor = await createAccount(world, ["parent"]);
      await waited(actor, async (client) => {
        if (kind === "role")
          await client.query("DELETE FROM user_roles WHERE user_id=$1", [
            actor.id,
          ]);
        if (kind === "session")
          await client.query('DELETE FROM "session" WHERE user_id=$1', [
            actor.id,
          ]);
        if (kind === "access")
          await client.query(
            "UPDATE user_access SET status='suspended' WHERE user_id=$1",
            [actor.id],
          );
        if (kind === "verification")
          await client.query(
            'UPDATE "user" SET email_verified=false WHERE id=$1',
            [actor.id],
          );
      });
    },
  );
  it("rolls back profile and link if audit insertion fails", async () => {
    const actor = await createAccount(world, ["parent"]);
    await world.owner.pool
      .query(`CREATE FUNCTION public.test_learner_origin_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END; $$;
      CREATE TRIGGER test_learner_origin_failure BEFORE INSERT ON learner_creation_events FOR EACH ROW EXECUTE FUNCTION public.test_learner_origin_failure()`);
    const before = (
      await world.owner.pool.query(
        "SELECT count(*)::int AS count FROM learner_profiles",
      )
    ).rows[0].count;
    try {
      expect((await request(actor, values())).status).toBe(503);
      expect(await counts(actor.id)).toEqual({ events: 0, links: 0 });
      expect(
        (
          await world.owner.pool.query(
            "SELECT count(*)::int AS count FROM learner_profiles",
          )
        ).rows[0].count,
      ).toBe(before);
    } finally {
      await world.owner.pool.query(
        "DROP TRIGGER test_learner_origin_failure ON learner_creation_events; DROP FUNCTION public.test_learner_origin_failure()",
      );
    }
  });
  it("direct narrow function rejects forged/expired sessions and malformed values without writes", async () => {
    const actor = await createAccount(world, ["parent"]);
    const ownSession = (
      await world.owner.pool.query(
        'SELECT id FROM "session" WHERE user_id=$1',
        [actor.id],
      )
    ).rows[0].id;
    const foreignSession = (
      await world.owner.pool.query(
        'SELECT id FROM "session" WHERE user_id=$1',
        [parent.id],
      )
    ).rows[0].id;
    const invoke = (
      session: string,
      name: string,
      level: string,
      zone: string,
    ) =>
      world.runtime.pool.query(
        "SELECT * FROM public.create_local_learner($1,$2,$3,'guardian',$4,$5,$6)",
        [actor.id, session, randomUUID(), name, level, zone],
      );
    expect(
      (await invoke(foreignSession, base.displayName, "elementary", "UTC"))
        .rows[0].outcome,
    ).toBe("forbidden");
    for (const fields of [
      [" ", "elementary", "UTC"],
      ["\t", "elementary", "UTC"],
      [base.displayName, "bad", "UTC"],
      [base.displayName, "elementary", "Etc/GMT+8"],
      [base.displayName, "elementary", "Mars/Olympus"],
    ])
      expect(
        (await invoke(ownSession, fields[0], fields[1], fields[2])).rows[0]
          .outcome,
      ).toBe("invalid");
    await world.owner.pool.query(
      `UPDATE "session" SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1`,
      [ownSession],
    );
    expect(
      (await invoke(ownSession, base.displayName, "elementary", "UTC")).rows[0]
        .outcome,
    ).toBe("forbidden");
    expect(await counts(actor.id)).toEqual({ events: 0, links: 0 });
  });
  it("runtime cannot raw-insert profiles/links/history or edit/delete origin and PUBLIC cannot execute", async () => {
    const actor = await createAccount(world, ["parent"]),
      profile = await create(actor, values());
    for (const query of [
      "INSERT INTO learner_profiles(id) VALUES($1)",
      "INSERT INTO guardian_learner_links(learner_id) VALUES($1)",
      "INSERT INTO learner_creation_events(learner_id) VALUES($1)",
      "UPDATE learner_creation_events SET origin='local_creation' WHERE learner_id=$1",
      "DELETE FROM learner_creation_events WHERE learner_id=$1",
    ])
      await expect(
        world.runtime.pool.query(query, [profile.id]),
      ).rejects.toMatchObject({ code: "42501" });
    await expect(
      world.owner.pool.query(
        "UPDATE learner_creation_events SET origin='local_creation' WHERE learner_id=$1",
        [profile.id],
      ),
    ).rejects.toMatchObject({ code: "55000" });
    const permissions = (
      await world.owner.pool.query(
        "SELECT prosecdef, proconfig, has_function_privilege('learli_app',oid,'EXECUTE') AS app, coalesce(array_to_string(proacl,','),'') AS acl FROM pg_proc WHERE proname='create_local_learner'",
      )
    ).rows[0];
    expect(permissions).toMatchObject({
      prosecdef: true,
      app: true,
      proconfig: ["search_path=pg_catalog"],
    });
    expect(permissions.acl).not.toMatch(/(^|,)=X/);
  });
});
