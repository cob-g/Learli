import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { handleParentOnboarding } from "@/features/parent-onboarding/handler";
import {
  closeWorld,
  createAccount,
  jsonRequest,
  openWorld,
  type TestAccount,
  type World,
} from "./support";

let world: World;
beforeAll(() => {
  world = openWorld();
});
beforeEach(async () => {
  await world.owner.pool.query(
    'TRUNCATE TABLE "user",rate_limit,verification CASCADE',
  );
});
afterAll(() => closeWorld(world));

function enroll(
  account?: TestAccount,
  body: unknown = {},
  method = "POST",
  origin?: string,
) {
  return handleParentOnboarding(
    world.runtime,
    jsonRequest(world, "/api/account/parent-onboarding", {
      cookie: account?.cookie,
      method,
      origin,
      ...(method === "GET" ? {} : { body }),
    }),
  );
}
async function state(id: string) {
  const roles = await world.owner.pool.query(
    "SELECT role FROM user_roles WHERE user_id=$1 ORDER BY role",
    [id],
  );
  const audit = await world.owner.pool.query(
    "SELECT actor_user_id,target_user_id,action FROM audit_events WHERE target_user_id=$1 AND action='parent_role.self_granted'",
    [id],
  );
  return { roles: roles.rows.map((r) => r.role), audit: audit.rows };
}
async function sessionId(id: string) {
  return (
    await world.owner.pool.query(
      "SELECT id FROM session WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1",
      [id],
    )
  ).rows[0].id as string;
}
async function waitForLock(client: PoolClient, pid: number) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    await client.query("SELECT pg_stat_clear_snapshot()");
    const result = await client.query(
      "SELECT wait_event_type='Lock' AS waiting FROM pg_stat_activity WHERE pid=$1",
      [pid],
    );
    if (result.rows[0]?.waiting) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Owned parent enrollment did not reach its lock barrier.");
}

describe("verified self-only parent enrollment", () => {
  it("grants one parent workspace with one audit and never creates a learner or guardian link", async () => {
    const account = await createAccount(world);
    expect((await state(account.id)).roles).toEqual([]);
    const response = await enroll(account);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ready: true, granted: true });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await state(account.id)).toEqual({
      roles: ["parent"],
      audit: [
        {
          actor_user_id: account.id,
          target_user_id: account.id,
          action: "parent_role.self_granted",
        },
      ],
    });
    expect(
      (
        await world.owner.pool.query(
          "SELECT (SELECT count(*)::int FROM learner_profiles) AS learners,(SELECT count(*)::int FROM guardian_learner_links) AS links",
        )
      ).rows[0],
    ).toEqual({ learners: 0, links: 0 });
  });
  it("preserves another legitimate role and makes concurrent repeated requests idempotent", async () => {
    const account = await createAccount(world, ["tutor"]);
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => enroll(account)),
    );
    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(200));
    const results = await Promise.all(responses.map((r) => r.json()));
    expect(results.filter((r) => r.granted)).toHaveLength(1);
    expect(results.every((r) => r.ready)).toBe(true);
    expect((await state(account.id)).roles).toEqual(["parent", "tutor"]);
    expect((await state(account.id)).audit).toHaveLength(1);
  });
  it.each([
    { role: "admin" },
    { roles: ["admin", "parent"] },
    { userId: "another-account" },
    { ownerId: "another-account" },
  ])("rejects trusted fields supplied by the browser: %j", async (body) => {
    const account = await createAccount(world);
    expect((await enroll(account, body)).status).toBe(400);
    expect(await state(account.id)).toEqual({ roles: [], audit: [] });
  });
  it("requires an active authenticated request, exact origin, POST and JSON", async () => {
    const account = await createAccount(world);
    expect((await enroll()).status).toBe(401);
    expect(
      (await enroll(account, {}, "POST", "https://unrelated.test")).status,
    ).toBe(403);
    expect((await enroll(account, undefined, "GET")).status).toBe(405);
    expect(
      (
        await handleParentOnboarding(
          world.runtime,
          new Request(`${world.runtime.origin}/api/account/parent-onboarding`, {
            method: "POST",
            headers: {
              origin: world.runtime.origin,
              cookie: account.cookie,
              "content-type": "application/x-www-form-urlencoded",
            },
            body: "role=parent",
          }),
        )
      ).status,
    ).toBe(400);
    expect(await state(account.id)).toEqual({ roles: [], audit: [] });
  });
  it.each(["unverified", "suspended", "expired", "revoked"] as const)(
    "denies current %s state at both service and authoritative SQL boundary",
    async (mode) => {
      const account = await createAccount(world);
      const session = await sessionId(account.id);
      if (mode === "unverified")
        await world.owner.pool.query(
          'UPDATE "user" SET email_verified=false WHERE id=$1',
          [account.id],
        );
      if (mode === "suspended")
        await world.owner.pool.query(
          "UPDATE user_access SET status='suspended' WHERE user_id=$1",
          [account.id],
        );
      if (mode === "expired")
        await world.owner.pool.query(
          "UPDATE session SET expires_at=clock_timestamp()-interval '1 minute' WHERE id=$1",
          [session],
        );
      if (mode === "revoked")
        await world.owner.pool.query("DELETE FROM session WHERE id=$1", [
          session,
        ]);
      expect([401, 403]).toContain((await enroll(account)).status);
      expect(
        (
          await world.runtime.pool.query(
            "SELECT enroll_parent_workspace($1,$2) AS outcome",
            [account.id, session],
          )
        ).rows[0].outcome,
      ).toBe("forbidden");
      expect(await state(account.id)).toEqual({ roles: [], audit: [] });
    },
  );
  it("rejects another account's session and retains read-only role-table privileges", async () => {
    const first = await createAccount(world),
      second = await createAccount(world);
    expect(
      (
        await world.runtime.pool.query(
          "SELECT enroll_parent_workspace($1,$2) AS outcome",
          [first.id, await sessionId(second.id)],
        )
      ).rows[0].outcome,
    ).toBe("forbidden");
    await expect(
      world.runtime.pool.query(
        "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
        [first.id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      (
        await world.owner.pool.query(
          "SELECT has_function_privilege('learli_app','public.enroll_parent_workspace(text,text)','EXECUTE') AS allowed,has_function_privilege('learli_app','public.enroll_parent_workspace(text,text)','EXECUTE WITH GRANT OPTION') AS grantable, EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid='public.enroll_parent_workspace(text,text)'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE') AS public",
        )
      ).rows[0],
    ).toEqual({ allowed: true, grantable: false, public: false });
    expect(await state(first.id)).toEqual({ roles: [], audit: [] });
    expect(await state(second.id)).toEqual({ roles: [], audit: [] });
  });
  it("rolls the role back when the audit fails, then recovers through the same operation", async () => {
    const account = await createAccount(world);
    await world.owner.pool.query(
      "ALTER TABLE audit_events ADD CONSTRAINT parent_onboarding_audit_failure CHECK(action<>'parent_role.self_granted') NOT VALID",
    );
    try {
      expect((await enroll(account)).status).toBe(503);
      expect(await state(account.id)).toEqual({ roles: [], audit: [] });
    } finally {
      await world.owner.pool.query(
        "ALTER TABLE audit_events DROP CONSTRAINT parent_onboarding_audit_failure",
      );
    }
    expect((await enroll(account)).status).toBe(200);
    expect((await state(account.id)).audit).toHaveLength(1);
  });
  it("rechecks suspension after the exact actor lock becomes available", async () => {
    const account = await createAccount(world);
    const session = await sessionId(account.id);
    const owner = await world.owner.pool.connect(),
      runtime = await world.runtime.pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await owner.query("BEGIN");
      await owner.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
        account.id,
      ]);
      const pid = (await runtime.query("SELECT pg_backend_pid() AS pid"))
        .rows[0].pid as number;
      const query = runtime.query(
        "SELECT enroll_parent_workspace($1,$2) AS outcome",
        [account.id, session],
      );
      pending = query;
      await waitForLock(owner, pid);
      await owner.query(
        "UPDATE user_access SET status='suspended' WHERE user_id=$1",
        [account.id],
      );
      await owner.query("COMMIT");
      expect((await query).rows[0].outcome).toBe("forbidden");
      expect(await state(account.id)).toEqual({ roles: [], audit: [] });
    } finally {
      await owner.query("ROLLBACK");
      await pending?.catch(() => undefined);
      runtime.release();
      owner.release();
    }
  });
  it("refuses a stale-snapshot transaction rather than relying on old identity state", async () => {
    const account = await createAccount(world);
    const runtime = await world.runtime.pool.connect();
    try {
      await runtime.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await expect(
        runtime.query("SELECT enroll_parent_workspace($1,$2)", [
          account.id,
          await sessionId(account.id),
        ]),
      ).rejects.toMatchObject({ code: "25001" });
    } finally {
      await runtime.query("ROLLBACK");
      runtime.release();
    }
    expect(await state(account.id)).toEqual({ roles: [], audit: [] });
  });
});
