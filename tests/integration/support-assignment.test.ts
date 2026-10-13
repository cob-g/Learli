import { password } from "./support";
import { refreshTestAdmin } from "../support/admin-mfa";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCase,
  readCase,
  changeCaseStatus,
} from "@/features/support/service";
import {
  listDispatchCases,
  readDispatchCase,
  changeAssignment,
} from "@/features/support/dispatch-service";
import { handleDispatchRequest } from "@/features/support/dispatch-handler";
import { provisionFixtureDispatch } from "@/features/support/dispatch-tooling";
import {
  authorizeFixtureReviewer,
  assignFixtureCase,
} from "@/features/support/fixture-tooling";
import {
  openWorld,
  closeWorld,
  createAccount,
  jsonRequest,
  type World,
  type TestAccount,
} from "./support";
let world: World,
  dispatcher: TestAccount,
  reviewer: TestAccount,
  alternate: TestAccount,
  admin: TestAccount;
const values = () => ({
  requestKey: randomUUID(),
  category: "safety",
  subject: "Private synthetic subject",
  body: "Private synthetic body never in dispatcher DTO",
});
const input = (revision = 0, kind = "assign", reviewerId = reviewer.id) => ({
  revision,
  kind,
  reviewerId,
  requestKey: randomUUID(),
});
async function fixture(staff = dispatcher, targets = [reviewer, alternate]) {
  const requester = await createAccount(
    world,
    [],
    "Private synthetic requester",
  );
  const id = (await createCase(world.runtime, requester.headers, values())).id;
  await provisionFixtureDispatch(
    world.owner,
    id,
    staff.id,
    "dispatcher",
    "authorized",
  );
  for (const target of targets)
    await provisionFixtureDispatch(
      world.owner,
      id,
      target.id,
      "reviewer_choice",
      "authorized",
    );
  return { id, requester };
}
const mutation = (staff: TestAccount, id: string, body: unknown) =>
  handleDispatchRequest(
    world.runtime,
    jsonRequest(world, `/api/admin/support/dispatch/${id}`, {
      method: "PATCH",
      cookie: staff.cookie,
      body,
    }),
    id,
  );
async function snapshot(id: string) {
  return (
    await world.owner.pool.query(
      "SELECT revision,status,(SELECT reviewer_user_id FROM support_case_assignments WHERE case_id=$1) AS reviewer,(SELECT count(*)::int FROM support_case_events WHERE case_id=$1) AS events,(SELECT count(*)::int FROM support_assignment_events WHERE case_id=$1) AS receipts FROM support_cases WHERE id=$1",
      [id],
    )
  ).rows[0];
}
async function blocked() {
  for (let i = 0; i < 100; i++) {
    const row = await world.owner.pool.query(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND (query LIKE '%change_local_support_assignment%' OR query LIKE '%support_cases%')",
    );
    if (row.rows[0].n > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Expected actual database lock wait.");
}
beforeAll(async () => {
  world = openWorld();
  dispatcher = await createAccount(world, ["admin"], "Dispatcher fixture");
  reviewer = await createAccount(world, ["admin"], "Reviewer fixture");
  alternate = await createAccount(world, ["admin"], "Alternative fixture");
  admin = await createAccount(world, ["admin"]);
  await authorizeFixtureReviewer(world.owner, reviewer.id);
  await authorizeFixtureReviewer(world.owner, alternate.id);
}, 30000);
beforeEach(() => world.owner.pool.query("UPDATE rate_limit SET count=0"));
afterAll(() => closeWorld(world));
describe("case-scoped support assignment on real PostgreSQL", () => {
  it("assigns/reassigns/escalates atomically with minimal immutable audit and immediate old reviewer denial", async () => {
    const { id, requester } = await fixture();
    expect(
      await changeAssignment(world.runtime, dispatcher.headers, id, input()),
    ).toEqual({ revision: 1, replayed: false });
    const detail = await readDispatchCase(
      world.runtime,
      dispatcher.headers,
      id,
    );
    expect(detail.reviewer).toBe(reviewer.name);
    expect(detail.choices).toEqual([
      { id: alternate.id, name: alternate.name },
    ]);
    expect(
      await changeAssignment(
        world.runtime,
        dispatcher.headers,
        id,
        input(1, "escalate", alternate.id),
      ),
    ).toEqual({ revision: 2, replayed: false });
    await expect(
      readCase(world.runtime, reviewer.headers, id, "reviewer"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      changeCaseStatus(world.runtime, reviewer.headers, id, {
        revision: 1,
        status: "in_review",
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (await readCase(world.runtime, alternate.headers, id, "reviewer"))
        .revision,
    ).toBe(2);
    await changeAssignment(
      world.runtime,
      dispatcher.headers,
      id,
      input(2, "reassign"),
    );
    expect(
      (
        await readCase(world.runtime, requester.headers, id, "requester")
      ).history.map((e) => e.action),
    ).toEqual(["created", "assigned", "reassigned", "reassigned"]);
    expect(
      (
        await readDispatchCase(world.runtime, dispatcher.headers, id)
      ).history.map((e) => e.kind),
    ).toEqual(["reassign", "escalate", "assign"]);
    const receipts = await world.owner.pool.query(
      "SELECT actor_user_id,revision,expected_revision FROM support_assignment_events WHERE case_id=$1 ORDER BY revision",
      [id],
    );
    expect(receipts.rows).toEqual(
      [1, 2, 3].map((revision) => ({
        actor_user_id: dispatcher.id,
        revision,
        expected_revision: revision - 1,
      })),
    );
  });
  it("history distinguishes owner-tooling events from dispatcher receipts across cases", async () => {
    const dispatched = await fixture();
    await changeAssignment(
      world.runtime,
      dispatcher.headers,
      dispatched.id,
      input(),
    );
    const runtimeHistory = (
      await readCase(
        world.runtime,
        dispatched.requester.headers,
        dispatched.id,
        "requester",
      )
    ).history;
    expect(runtimeHistory.map((e) => e.dispatcher)).toEqual([false, true]);
    const owned = await fixture();
    await assignFixtureCase(world.owner, owned.id, reviewer.id);
    await assignFixtureCase(world.owner, owned.id, alternate.id);
    const fixtureHistory = (
      await readCase(
        world.runtime,
        owned.requester.headers,
        owned.id,
        "requester",
      )
    ).history;
    expect(fixtureHistory.map((e) => e.dispatcher)).toEqual([
      false,
      false,
      false,
    ]);
  });
  it("denies plain admin, requester, unrelated dispatcher and self assignment with generic absence", async () => {
    const { id, requester } = await fixture();
    for (const person of [admin, requester])
      expect((await mutation(person, id, input())).status).toBe(
        person === admin ? 404 : 403,
      );
    await expect(
      readDispatchCase(world.runtime, admin.headers, id),
    ).rejects.toMatchObject({ status: 404 });
    await authorizeFixtureReviewer(world.owner, dispatcher.id);
    await provisionFixtureDispatch(
      world.owner,
      id,
      dispatcher.id,
      "reviewer_choice",
      "authorized",
    );
    expect(
      (await mutation(dispatcher, id, input(0, "assign", dispatcher.id)))
        .status,
    ).toBe(404);
    expect(
      (
        await readDispatchCase(world.runtime, dispatcher.headers, id)
      ).choices.map((c) => c.id),
    ).not.toContain(dispatcher.id);
    await expect(
      provisionFixtureDispatch(
        world.owner,
        id,
        requester.id,
        "dispatcher",
        "authorized",
      ),
    ).rejects.toThrow();
    expect((await snapshot(id)).revision).toBe(0);
  });
  it("rejects reviewers not chosen for the exact case and excludes revoked/ineligible choices without contacts", async () => {
    const { id } = await fixture(dispatcher, [reviewer]);
    expect(
      (await mutation(dispatcher, id, input(0, "assign", alternate.id))).status,
    ).toBe(404);
    await provisionFixtureDispatch(
      world.owner,
      id,
      reviewer.id,
      "reviewer_choice",
      "revoked",
    );
    expect(
      (await readDispatchCase(world.runtime, dispatcher.headers, id)).choices,
    ).toEqual([]);
    expect((await mutation(dispatcher, id, input())).status).toBe(404);
    await expect(
      provisionFixtureDispatch(
        world.owner,
        id,
        reviewer.id,
        "reviewer_choice",
        "authorized",
      ),
    ).rejects.toThrow("revoked");
    const dto = JSON.stringify(
      await readDispatchCase(world.runtime, dispatcher.headers, id),
    );
    for (const privateValue of [
      "Private synthetic",
      reviewer.email,
      alternate.email,
      '"body"',
      '"subject"',
      '"booking"',
      '"requesterUserId"',
      '"previousReviewerId"',
      '"nextReviewerId"',
      '"requestKey"',
    ])
      expect(dto).not.toContain(privateValue);
  });
  it("same-key simultaneous retries create one assignment and receipt", async () => {
    const { id } = await fixture(),
      body = input();
    const rows = await Promise.all([
      changeAssignment(world.runtime, dispatcher.headers, id, body),
      changeAssignment(world.runtime, dispatcher.headers, id, body),
    ]);
    expect(rows.map((r) => r.replayed).sort()).toEqual([false, true]);
    expect(await snapshot(id)).toMatchObject({
      revision: 1,
      events: 2,
      receipts: 1,
    });
    expect(
      (await mutation(dispatcher, id, { ...body, reviewerId: alternate.id }))
        .status,
    ).toBe(409);
    expect(
      (await mutation(dispatcher, id, { ...body, kind: "escalate" })).status,
    ).toBe(409);
  });
  it("one stale competing writer wins and status changes share revision", async () => {
    const { id } = await fixture();
    const results = await Promise.all([
      mutation(dispatcher, id, input()),
      mutation(dispatcher, id, input(0, "assign", alternate.id)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const current =
      (await snapshot(id)).reviewer === reviewer.id ? reviewer : alternate;
    await changeCaseStatus(world.runtime, current.headers, id, {
      revision: 1,
      status: "in_review",
    });
    expect(
      (
        await mutation(
          dispatcher,
          id,
          input(
            1,
            "escalate",
            current === reviewer ? alternate.id : reviewer.id,
          ),
        )
      ).status,
    ).toBe(409);
    expect(await snapshot(id)).toMatchObject({
      revision: 2,
      receipts: 1,
      status: "in_review",
    });
  });
  it("actor-scoped keys cannot be reused across authorized cases", async () => {
    const a = await fixture(),
      b = await fixture(),
      body = input();
    const rows = await Promise.all([
      mutation(dispatcher, a.id, body),
      mutation(dispatcher, b.id, body),
    ]);
    expect(rows.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (await snapshot(a.id)).receipts + (await snapshot(b.id)).receipts,
    ).toBe(1);
  });
  it("closed cases reject new actions, replay is read-only, authorized reviewer reopening permits assignment", async () => {
    const { id } = await fixture(),
      body = input();
    await changeAssignment(world.runtime, dispatcher.headers, id, body);
    await changeCaseStatus(world.runtime, reviewer.headers, id, {
      revision: 1,
      status: "in_review",
    });
    await changeCaseStatus(world.runtime, reviewer.headers, id, {
      revision: 2,
      status: "closed",
    });
    expect(
      (await mutation(dispatcher, id, input(3, "escalate", alternate.id)))
        .status,
    ).toBe(409);
    expect(
      await changeAssignment(world.runtime, dispatcher.headers, id, body),
    ).toEqual({ revision: 1, replayed: true });
    expect(await snapshot(id)).toMatchObject({
      revision: 3,
      status: "closed",
      receipts: 1,
    });
    await changeCaseStatus(world.runtime, reviewer.headers, id, {
      revision: 3,
      status: "in_review",
    });
    expect(
      (await mutation(dispatcher, id, input(4, "escalate", alternate.id)))
        .status,
    ).toBe(200);
  });
  it.each(["dispatcher", "reviewer_choice"] as const)(
    "revoked %s grants deny replays and remain revoked on provisioning retry",
    async (kind) => {
      const { id } = await fixture(),
        body = input();
      await changeAssignment(world.runtime, dispatcher.headers, id, body);
      await provisionFixtureDispatch(
        world.owner,
        id,
        kind === "dispatcher" ? dispatcher.id : reviewer.id,
        kind,
        "revoked",
      );
      expect((await mutation(dispatcher, id, body)).status).toBe(404);
      await expect(
        provisionFixtureDispatch(
          world.owner,
          id,
          kind === "dispatcher" ? dispatcher.id : reviewer.id,
          kind,
          "authorized",
        ),
      ).rejects.toThrow("revoked");
      expect((await snapshot(id)).receipts).toBe(1);
    },
  );
  it.each([
    "dispatcher_grant",
    "choice",
    "capability",
    "actor_suspension",
    "reviewer_suspension",
    "actor_role",
    "reviewer_role",
    "session",
    "actor_verification",
    "reviewer_verification",
  ] as const)(
    "fresh post-lock denial after %s revocation race",
    async (change) => {
      const { id } = await fixture(),
        before = await snapshot(id),
        blocker = await world.owner.pool.connect();
      const updates: Record<typeof change, [string, unknown[]]> = {
        dispatcher_grant: [
          "UPDATE support_dispatch_grants SET status='revoked' WHERE case_id=$1",
          [id],
        ],
        choice: [
          "UPDATE support_reviewer_choices SET status='revoked' WHERE case_id=$1 AND reviewer_user_id=$2",
          [id, reviewer.id],
        ],
        capability: [
          "UPDATE support_reviewers SET status='revoked' WHERE user_id=$1",
          [reviewer.id],
        ],
        actor_suspension: [
          "UPDATE user_access SET status='suspended' WHERE user_id=$1",
          [dispatcher.id],
        ],
        reviewer_suspension: [
          "UPDATE user_access SET status='suspended' WHERE user_id=$1",
          [reviewer.id],
        ],
        actor_role: [
          "DELETE FROM user_roles WHERE user_id=$1 AND role='admin'",
          [dispatcher.id],
        ],
        reviewer_role: [
          "DELETE FROM user_roles WHERE user_id=$1 AND role='admin'",
          [reviewer.id],
        ],
        session: [
          "UPDATE session SET expires_at=now()-interval '1 second' WHERE user_id=$1",
          [dispatcher.id],
        ],
        actor_verification: [
          'UPDATE "user" SET email_verified=false WHERE id=$1',
          [dispatcher.id],
        ],
        reviewer_verification: [
          'UPDATE "user" SET email_verified=false WHERE id=$1',
          [reviewer.id],
        ],
      };
      try {
        await blocker.query("BEGIN");
        await blocker.query(
          "SELECT id FROM support_cases WHERE id=$1 FOR UPDATE",
          [id],
        );
        const pending = mutation(dispatcher, id, input());
        await blocked();
        await blocker.query(...updates[change]);
        await blocker.query("COMMIT");
        const response = await pending;
        expect(response.status).toBe(
          change.startsWith("actor_") || change === "session" ? 403 : 404,
        );
        expect(await snapshot(id)).toEqual(before);
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
        // Explicit isolated test teardown; application owner provisioning still preserves revocation.
        await world.owner.pool.query(
          "UPDATE support_reviewers SET status='authorized' WHERE user_id=$1",
          [reviewer.id],
        );
        await world.owner.pool.query(
          "UPDATE user_access SET status='active' WHERE user_id IN ($1,$2)",
          [reviewer.id, dispatcher.id],
        );
        await world.owner.pool.query(
          'UPDATE "user" SET email_verified=true WHERE id IN ($1,$2)',
          [reviewer.id, dispatcher.id],
        );
        await world.owner.pool.query(
          "INSERT INTO user_roles(user_id,role) VALUES ($1,'admin'),($2,'admin') ON CONFLICT DO NOTHING",
          [reviewer.id, dispatcher.id],
        );
        await world.owner.pool.query(
          "UPDATE session SET expires_at=now()+interval '1 day' WHERE user_id=$1",
          [dispatcher.id],
        );
        await world.owner.pool.query(
          "UPDATE rate_limit SET count=0 WHERE key LIKE '%/two-factor/%'",
        );
        await refreshTestAdmin(world.runtime, dispatcher, password);
        await refreshTestAdmin(world.runtime, reviewer, password);
      }
    },
  );
  it("assignment-first lock order denies queued former-reviewer status after commit", async () => {
    const { id } = await fixture();
    await assignFixtureCase(world.owner, id, reviewer.id);
    const blocker = await world.owner.pool.connect();
    try {
      await blocker.query("BEGIN");
      const session = (
        await blocker.query(
          "SELECT id FROM session WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1",
          [dispatcher.id],
        )
      ).rows[0].id;
      const changed = await blocker.query(
        "SELECT * FROM public.change_local_support_assignment($1,$2,$3,1,$4,'escalate',$5)",
        [dispatcher.id, session, id, alternate.id, randomUUID()],
      );
      expect(changed.rows[0].outcome).toBe("saved");
      const pending = changeCaseStatus(world.runtime, reviewer.headers, id, {
        revision: 1,
        status: "in_review",
      });
      const observed = pending.catch((error) => error);
      await blocked();
      await blocker.query("COMMIT");
      expect(await observed).toMatchObject({ status: 404 });
      expect(await snapshot(id)).toMatchObject({
        revision: 2,
        status: "open",
        reviewer: alternate.id,
      });
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
    }
  });
  it("audit failure rolls back assignment/revision/history atomically", async () => {
    const { id } = await fixture(),
      before = await snapshot(id),
      fn = `support_assignment_fail_${randomUUID().replaceAll("-", "")}`;
    await world.owner.pool.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.case_id='${id}'::uuid THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$`,
    );
    await world.owner.pool.query(
      `CREATE TRIGGER ${fn} BEFORE INSERT ON support_assignment_events FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
    );
    try {
      expect((await mutation(dispatcher, id, input())).status).toBe(503);
      expect(await snapshot(id)).toEqual(before);
    } finally {
      await world.owner.pool.query(
        `DROP TRIGGER ${fn} ON support_assignment_events`,
      );
      await world.owner.pool.query(`DROP FUNCTION ${fn}()`);
    }
  });
  it("runtime cannot directly grant, choose, assign, append or rewrite new audit; owner cannot rewrite immutable receipts", async () => {
    const { id } = await fixture();
    await changeAssignment(world.runtime, dispatcher.headers, id, input());
    for (const query of [
      "UPDATE support_dispatch_grants SET status='authorized' WHERE case_id=$1",
      "DELETE FROM support_reviewer_choices WHERE case_id=$1",
      "UPDATE support_case_assignments SET reviewer_user_id='forged' WHERE case_id=$1",
      "DELETE FROM support_assignment_events WHERE case_id=$1",
      "UPDATE support_dispatch_grant_events SET action='authorized' WHERE case_id=$1",
      "INSERT INTO support_assignment_events(case_id) VALUES($1)",
      "INSERT INTO support_dispatch_grants(case_id,dispatcher_user_id,source,status) VALUES($1,'forged','local_fixture','authorized')",
    ])
      await expect(world.runtime.pool.query(query, [id])).rejects.toMatchObject(
        { code: "42501" },
      );
    for (const table of [
      "support_assignment_events",
      "support_dispatch_grant_events",
    ])
      await expect(
        world.owner.pool.query(`DELETE FROM ${table} WHERE case_id=$1`, [id]),
      ).rejects.toMatchObject({ code: "55000" });
    await expect(
      provisionFixtureDispatch(
        { db: world.runtime.db, pool: world.runtime.pool },
        id,
        admin.id,
        "dispatcher",
        "authorized",
      ),
    ).rejects.toThrow("owner");
  });
  it("owner provisioning is retry-safe, bounded, and requires current reviewer/admin fixtures", async () => {
    const { id } = await fixture();
    await provisionFixtureDispatch(
      world.owner,
      id,
      dispatcher.id,
      "dispatcher",
      "authorized",
    );
    expect(
      (
        await world.owner.pool.query(
          "SELECT count(*)::int AS n FROM support_dispatch_grant_events WHERE case_id=$1 AND kind='dispatcher'",
          [id],
        )
      ).rows[0].n,
    ).toBe(1);
    await expect(
      provisionFixtureDispatch(
        world.owner,
        id,
        admin.id,
        "reviewer_choice",
        "authorized",
      ),
    ).rejects.toThrow("capability");
    expect(
      (await listDispatchCases(world.runtime, admin.headers)).cases,
    ).toEqual([]);
  });
  it("strict boundary denies forged/malformed/cross-origin methods, local gates and returns private no-store", async () => {
    const { id } = await fixture();
    for (const key of [
      "body",
      "role",
      "status",
      "source",
      "actorId",
      "bookingId",
    ])
      expect(
        (await mutation(dispatcher, id, { ...input(), [key]: "forged" }))
          .status,
      ).toBe(400);
    expect(
      (
        await handleDispatchRequest(
          world.runtime,
          jsonRequest(world, "/api/admin/support/dispatch", { method: "GET" }),
        )
      ).status,
    ).toBe(401);
    const cross = jsonRequest(world, `/api/admin/support/dispatch/${id}`, {
      method: "PATCH",
      cookie: dispatcher.cookie,
      body: input(),
      origin: "https://evil.test",
    });
    expect((await handleDispatchRequest(world.runtime, cross, id)).status).toBe(
      403,
    );
    expect((await handleDispatchRequest(null, cross, id)).status).toBe(503);
    await expect(
      listDispatchCases(
        { ...world.runtime, environment: "production" as never },
        dispatcher.headers,
      ),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      listDispatchCases(
        { ...world.runtime, origin: "https://learli.test" },
        dispatcher.headers,
      ),
    ).rejects.toMatchObject({ status: 503 });
    const response = await mutation(dispatcher, id, input());
    expect(response.headers.get("cache-control")).toContain(
      "private, no-store",
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(JSON.stringify(await response.json())).not.toContain(reviewer.id);
  });
});
