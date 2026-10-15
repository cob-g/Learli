import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { changeAccess } from "@/features/account-restrictions/service";
import {
  provisionRestrictionTarget,
  authorizeRestrictionTarget,
} from "@/features/account-restrictions/fixture-tooling";
import { createCase } from "@/features/support/service";
import { changeAssignment } from "@/features/support/dispatch-service";
import { provisionFixtureDispatch } from "@/features/support/dispatch-tooling";
import { authorizeFixtureReviewer } from "@/features/support/fixture-tooling";
import { reviewTutorApplication } from "@/features/tutors/review";
import { provisionScreeningAssignment } from "@/features/tutor-screening/fixture-tooling";
import { screeningFixture, observedLock } from "./screening-fixtures";
import { openWorld, closeWorld, createAccount, type World } from "./support";

let world: World;
beforeAll(() => {
  world = openWorld();
});
afterAll(() => closeWorld(world));
const functions = [
  "change_local_account_access",
  "change_local_support_assignment",
  "review_local_tutor_application",
] as const;
type FunctionName = (typeof functions)[number];
async function fixture(name: FunctionName) {
  const actor = await createAccount(world, ["admin"]);
  const session = await world.runtime.auth.api.getSession({
    headers: actor.headers,
  });
  if (!session) throw new Error("Actual provider session required.");
  const key = randomUUID();
  if (name === "change_local_account_access") {
    const target = await createAccount(world);
    await provisionRestrictionTarget(world.owner, target.id);
    await authorizeRestrictionTarget(world.owner, actor.id, target.id);
    const input = {
      revision: 0,
      requestKey: key,
      status: "suspended",
      reason: "local_access_test",
    };
    return {
      actor,
      sid: session.session.id,
      sql: "SELECT * FROM public.change_local_account_access($1,$2,$3,$4,$5,$6,$7::uuid)",
      values: [
        actor.id,
        session.session.id,
        target.id,
        0,
        input.status,
        input.reason,
        key,
      ],
      service: () =>
        changeAccess(world.runtime, actor.headers, target.id, input),
      lock: {
        sql: "SELECT user_id FROM account_restriction_targets WHERE user_id=$1 FOR UPDATE",
        id: target.id,
      },
      state: () =>
        domainState("access", target.id, actor.id, session.session.id),
    };
  }
  if (name === "change_local_support_assignment") {
    const requester = await createAccount(world),
      reviewer = await createAccount(world, ["admin"]);
    const c = await createCase(world.runtime, requester.headers, {
      requestKey: randomUUID(),
      category: "safety",
      subject: "Fictional local isolation concern",
      body: "Fictional test concern.",
    });
    await authorizeFixtureReviewer(world.owner, reviewer.id);
    await provisionFixtureDispatch(
      world.owner,
      c.id,
      actor.id,
      "dispatcher",
      "authorized",
    );
    await provisionFixtureDispatch(
      world.owner,
      c.id,
      reviewer.id,
      "reviewer_choice",
      "authorized",
    );
    const input = {
      revision: 0,
      requestKey: key,
      kind: "assign",
      reviewerId: reviewer.id,
    };
    return {
      actor,
      sid: session.session.id,
      sql: "SELECT * FROM public.change_local_support_assignment($1,$2,$3::uuid,$4,$5,$6,$7::uuid)",
      values: [
        actor.id,
        session.session.id,
        c.id,
        0,
        reviewer.id,
        "assign",
        key,
      ],
      service: () =>
        changeAssignment(world.runtime, actor.headers, c.id, input),
      lock: {
        sql: "SELECT id FROM support_cases WHERE id=$1 FOR UPDATE",
        id: c.id,
      },
      state: () => domainState("support", c.id, actor.id, session.session.id),
    };
  }
  // Legacy review must have no readiness case and a current local assignment.
  const f = await screeningFixture(world, actor, false);
  await provisionScreeningAssignment(
    world.owner,
    f.profile.id,
    actor.id,
    "local_fixture",
    new Date(Date.now() + 3600000),
  );
  return {
    actor,
    sid: session.session.id,
    sql: "SELECT * FROM public.review_local_tutor_application($1,$2,$3::uuid,$4)",
    values: [actor.id, session.session.id, f.profile.id, "approve"],
    service: () =>
      reviewTutorApplication(world.runtime, actor.headers, f.profile.id, {
        action: "approve",
      }),
    lock: {
      sql: "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
      id: f.profile.id,
    },
    state: () =>
      domainState("tutor", f.profile.id, actor.id, session.session.id),
  };
}
async function domainState(
  kind: "access" | "support" | "tutor",
  id: string,
  actor: string,
  sid: string,
) {
  const queries = {
    access: [
      "SELECT to_jsonb(t) row FROM user_access t WHERE user_id=$1",
      "SELECT to_jsonb(t) row FROM account_restriction_targets t WHERE user_id=$1",
      "SELECT to_jsonb(t) row FROM account_restriction_events t WHERE target_user_id=$1 ORDER BY revision",
      "SELECT to_jsonb(t) row FROM account_restriction_grants t WHERE target_user_id=$1 ORDER BY staff_user_id",
      "SELECT to_jsonb(t) row FROM account_restriction_grant_events t WHERE target_user_id=$1 ORDER BY created_at,id",
    ],
    support: [
      "SELECT to_jsonb(t) row FROM support_cases t WHERE id=$1",
      "SELECT to_jsonb(t) row FROM support_case_assignments t WHERE case_id=$1",
      "SELECT to_jsonb(t) row FROM support_case_events t WHERE case_id=$1 ORDER BY revision,action",
      "SELECT to_jsonb(t) row FROM support_assignment_events t WHERE case_id=$1 ORDER BY revision",
    ],
    tutor: [
      "SELECT to_jsonb(t) row FROM tutor_profiles t WHERE id=$1",
      "SELECT to_jsonb(t) row FROM tutor_screening_assignments t WHERE tutor_id=$1",
      "SELECT to_jsonb(t) row FROM tutor_screening_events t WHERE tutor_id=$1 ORDER BY created_at,id",
      "SELECT to_jsonb(t) row FROM tutor_screening_cases t WHERE tutor_id=$1",
    ],
  };
  const domain = [];
  for (const sql of queries[kind])
    domain.push((await world.owner.pool.query(sql, [id])).rows);
  return {
    domain,
    audit: (
      await world.owner.pool.query(
        "SELECT to_jsonb(t) row FROM audit_events t WHERE actor_user_id=$1 ORDER BY id",
        [actor],
      )
    ).rows,
    assurance: (
      await world.owner.pool.query(
        "SELECT to_jsonb(t) row FROM admin_assurance_receipts t WHERE session_id=$1",
        [sid],
      )
    ).rows,
  };
}
async function callAndCommit(
  caller: PoolClient,
  f: Awaited<ReturnType<typeof fixture>>,
) {
  try {
    const r = await caller.query(f.sql, f.values);
    // An unexpected return is committed and verified through the owner connection.
    // A serialization failure at COMMIT is a denial, never a successful exploit.
    await caller.query("COMMIT");
    return { outcome: r.rows[0]?.outcome, code: null, committed: true };
  } catch (error) {
    await caller.query("ROLLBACK");
    return {
      outcome: null,
      code:
        error && typeof error === "object" && "code" in error
          ? error.code
          : null,
      committed: false,
    };
  }
}
async function revokeAfterSnapshot(
  caller: PoolClient,
  f: Awaited<ReturnType<typeof fixture>>,
) {
  const query = "SELECT public.has_admin_assurance($1,$2,28800) allowed";
  expect((await caller.query(query, [f.actor.id, f.sid])).rows[0].allowed).toBe(
    true,
  );
  await world.owner.pool.query(
    "DELETE FROM user_roles WHERE user_id=$1 AND role='admin'",
    [f.actor.id],
  );
  expect(
    (await world.owner.pool.query(query, [f.actor.id, f.sid])).rows[0].allowed,
  ).toBe(false);
  expect((await caller.query(query, [f.actor.id, f.sid])).rows[0].allowed).toBe(
    true,
  );
}
describe.each(functions)("%s requires fresh current authority", (name) => {
  it.each(["REPEATABLE READ", "SERIALIZABLE"] as const)(
    "rejects %s after another transaction revokes admin; service denies403 and no state/history/receipts change",
    async (mode) => {
      const f = await fixture(name),
        before = await f.state(),
        caller = await world.runtime.pool.connect();
      try {
        expect(
          (await caller.query("SELECT current_user AS role")).rows[0].role,
        ).toBe("learli_app");
        await caller.query(`BEGIN ISOLATION LEVEL ${mode}`);
        await revokeAfterSnapshot(caller, f);
        await expect(f.service()).rejects.toMatchObject({ status: 403 });
        const result = await callAndCommit(caller, f);
        console.info(
          "Local mutation isolation observation",
          JSON.stringify({
            name,
            mode,
            ...result,
            durableStateChanged:
              JSON.stringify(await f.state()) !== JSON.stringify(before),
          }),
        );
        expect
          .soft(result)
          .toEqual({ outcome: null, code: "25001", committed: false });
        expect(await f.state()).toEqual(before);
      } finally {
        await caller.query("ROLLBACK");
        caller.release();
      }
    },
    30000,
  );
  it("valid READ COMMITTED saves once; exact-key replay or strict repeated review preserves history", async () => {
    const f = await fixture(name),
      before = await f.state(),
      caller = await world.runtime.pool.connect();
    try {
      await caller.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      expect(await callAndCommit(caller, f)).toEqual({
        outcome: "saved",
        code: null,
        committed: true,
      });
      const saved = await f.state();
      expect(saved).not.toEqual(before);
      if (name === "change_local_account_access") {
        expect(saved.domain[0][0].row).toMatchObject({ status: "suspended" });
        expect(saved.domain[1][0].row).toMatchObject({ revision: 1 });
        expect(saved.domain[2]).toHaveLength(1);
        expect(saved.domain[2][0].row).toMatchObject({
          expected_revision: 0,
          revision: 1,
          previous_status: "active",
          next_status: "suspended",
          reason: "local_access_test",
        });
      } else if (name === "change_local_support_assignment") {
        expect(saved.domain[0][0].row).toMatchObject({
          revision: 1,
          status: "open",
        });
        expect(saved.domain[1]).toHaveLength(1);
        expect(saved.domain[2]).toHaveLength(2);
        expect(saved.domain[3]).toHaveLength(1);
        expect(saved.domain[3][0].row).toMatchObject({
          expected_revision: 0,
          revision: 1,
          kind: "assign",
          previous_reviewer_id: null,
          next_reviewer_id: saved.domain[1][0].row.reviewer_user_id,
        });
      } else {
        // createAccount registers through composeAccountAuth's user-create hook.
        // Its account.created event precedes the single review mutation.
        expect(before.audit.map((entry) => entry.row.action)).toEqual([
          "account.created",
        ]);
        expect(saved.domain[0][0].row).toMatchObject({
          review_status: "approved",
        });
        expect(saved.domain[3]).toHaveLength(0);
        expect(saved.audit).toHaveLength(before.audit.length + 1);
        expect(saved.audit.map((entry) => entry.row)).toEqual(
          expect.arrayContaining(before.audit.map((entry) => entry.row)),
        );
        expect(
          saved.audit.find(
            (entry) => entry.row.action === "tutor_review.approved",
          )?.row,
        ).toMatchObject({
          action: "tutor_review.approved",
          actor_user_id: f.actor.id,
        });
      }
      expect(saved.assurance).toEqual(before.assurance);
      await caller.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      expect(await callAndCommit(caller, f)).toEqual({
        outcome:
          name === "review_local_tutor_application" ? "conflict" : "replayed",
        code: null,
        committed: true,
      });
      expect(await f.state()).toEqual(saved);
    } finally {
      await caller.query("ROLLBACK");
      caller.release();
    }
  }, 30000);
  it("READ COMMITTED rechecks revocation after an observed domain lock wait with no effects", async () => {
    const f = await fixture(name),
      before = await f.state(),
      lock = await world.owner.pool.connect(),
      caller = await world.runtime.pool.connect();
    let pending: ReturnType<typeof callAndCommit> | undefined;
    try {
      await lock.query("BEGIN");
      await lock.query(f.lock.sql, [f.lock.id]);
      await caller.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      pending = callAndCommit(caller, f);
      await observedLock(world, name);
      await world.owner.pool.query(
        "DELETE FROM user_roles WHERE user_id=$1 AND role='admin'",
        [f.actor.id],
      );
      await lock.query("COMMIT");
      expect(await pending).toEqual({
        outcome: "forbidden",
        code: null,
        committed: true,
      });
      expect(await f.state()).toEqual(before);
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
      await pending;
      await caller.query("ROLLBACK");
      caller.release();
    }
  }, 30000);
  it.each(["REPEATABLE READ", "SERIALIZABLE", "READ UNCOMMITTED"] as const)(
    "rejects %s before invalid arguments or domain work",
    async (mode) => {
      const caller = await world.runtime.pool.connect();
      const sql =
        name === "review_local_tutor_application"
          ? "SELECT * FROM public.review_local_tutor_application(NULL,NULL,NULL,NULL)"
          : name === "change_local_support_assignment"
            ? "SELECT * FROM public.change_local_support_assignment(NULL,NULL,NULL,NULL,NULL,NULL,NULL)"
            : "SELECT * FROM public.change_local_account_access(NULL,NULL,NULL,NULL,NULL,NULL,NULL)";
      try {
        await caller.query(`BEGIN ISOLATION LEVEL ${mode}`);
        await expect(caller.query(sql)).rejects.toMatchObject({
          code: "25001",
        });
      } finally {
        await caller.query("ROLLBACK");
        caller.release();
      }
    },
  );
});
