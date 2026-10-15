import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { recordScreeningCheck } from "@/features/tutor-screening/service";
import {
  createSafeguardingCase,
  changeSafeguardingResponse,
  changeSafetyRestriction,
} from "@/features/safeguarding/service";
import {
  provisionResponseGrant,
  provisionSafetyRestriction,
} from "@/features/safeguarding/fixture-tooling";
import {
  screeningFixture,
  responseFixture,
  observedLock,
} from "./screening-fixtures";
import { openWorld, closeWorld, createAccount, type World } from "./support";

let world: World;
beforeAll(() => {
  world = openWorld();
});
afterAll(async () => {
  await world.owner.pool.query(
    "UPDATE tutor_screening_policy_heads SET status='revoked'",
  );
  await world.owner.pool.query(
    "UPDATE support_response_policy_heads SET status='revoked'",
  );
  await closeWorld(world);
});
const functions = [
  "record_tutor_screening_check",
  "change_safeguarding_response",
  "change_safeguarding_access",
] as const;
type FunctionName = (typeof functions)[number];
async function fixture(name: FunctionName) {
  // This actor is deliberately separate from the policy's responsible owners:
  // revoking it changes authority, not any domain row or policy membership.
  const actor = await createAccount(world, ["admin"]);
  const session = await world.runtime.auth.api.getSession({
    headers: actor.headers,
  });
  if (!session) throw new Error("Actual provider session required.");
  const key = randomUUID();
  if (name === "record_tutor_screening_check") {
    const f = await screeningFixture(world, actor);
    const input = {
      revision: 0,
      requestKey: key,
      code: "synthetic_check_a",
      outcome: "passed",
      reference: `screening:${randomUUID()}`,
      checkedAt: new Date(Date.now() - 60000).toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    return {
      actor,
      sid: session.session.id,
      sql: "SELECT * FROM public.record_tutor_screening_check($1,$2,$3::uuid,$4,$5::uuid,$6,$7,$8,$9::timestamptz,$10::timestamptz)",
      values: [
        actor.id,
        session.session.id,
        f.profile.id,
        input.revision,
        key,
        input.code,
        input.outcome,
        input.reference,
        input.checkedAt,
        input.expiresAt,
      ],
      service: () =>
        recordScreeningCheck(f.context, actor.headers, f.profile.id, input),
      lock: {
        sql: "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
        id: f.profile.id,
      },
      state: () =>
        domainState("screening", f.profile.id, actor.id, session.session.id),
    };
  }
  const reviewer = await createAccount(world, ["admin"]),
    escalation = await createAccount(world, ["admin"]);
  const f = await responseFixture(world, reviewer, escalation);
  const requester = await createAccount(world, ["parent"]);
  if (name === "change_safeguarding_response") {
    const c = await createSafeguardingCase(f.context, requester.headers, {
      category: "safety",
      subject: "Fictional isolation concern",
      body: "Fictional readiness concern.",
      requestKey: randomUUID(),
    });
    await provisionResponseGrant(
      world.owner,
      c.id,
      actor.id,
      "dispatcher",
      f.expiry,
    );
    await provisionResponseGrant(
      world.owner,
      c.id,
      reviewer.id,
      "reviewer_choice",
      f.expiry,
    );
    const input = {
      revision: 0,
      requestKey: key,
      action: "assign",
      targetId: reviewer.id,
    };
    return {
      actor,
      sid: session.session.id,
      sql: "SELECT * FROM public.change_safeguarding_response($1,$2,$3::uuid,$4,$5::uuid,$6,$7)",
      values: [
        actor.id,
        session.session.id,
        c.id,
        0,
        key,
        "assign",
        reviewer.id,
      ],
      service: () =>
        changeSafeguardingResponse(f.context, actor.headers, c.id, input),
      lock: {
        sql: "SELECT id FROM support_cases WHERE id=$1 FOR UPDATE",
        id: c.id,
      },
      state: () => domainState("response", c.id, actor.id, session.session.id),
    };
  }
  await provisionSafetyRestriction(
    world.owner,
    actor.id,
    requester.id,
    f.expiry,
  );
  const input = {
    revision: 0,
    requestKey: key,
    action: "restrict",
    reason: "synthetic_safety_restrict",
  };
  return {
    actor,
    sid: session.session.id,
    sql: "SELECT * FROM public.change_safeguarding_access($1,$2,$3,$4,$5,$6,$7::uuid)",
    values: [
      actor.id,
      session.session.id,
      requester.id,
      0,
      input.action,
      input.reason,
      key,
    ],
    service: () =>
      changeSafetyRestriction(f.context, actor.headers, requester.id, input),
    lock: {
      sql: "SELECT user_id FROM account_restriction_targets WHERE user_id=$1 FOR UPDATE",
      id: requester.id,
    },
    state: () =>
      domainState("access", requester.id, actor.id, session.session.id),
  };
}
async function domainState(
  kind: "screening" | "response" | "access",
  id: string,
  actor: string,
  sid: string,
) {
  const queries = {
    screening: [
      "SELECT to_jsonb(t) row FROM tutor_profiles t WHERE id=$1",
      "SELECT to_jsonb(t) row FROM tutor_screening_cases t WHERE tutor_id=$1",
      "SELECT to_jsonb(t) row FROM tutor_screening_checks t WHERE tutor_id=$1 ORDER BY revision",
      "SELECT to_jsonb(t) row FROM tutor_screening_events t WHERE tutor_id=$1 ORDER BY revision",
      "SELECT to_jsonb(t) row FROM tutor_screening_decisions t WHERE tutor_id=$1 ORDER BY revision",
      "SELECT to_jsonb(t) row FROM tutor_screening_decision_checks t JOIN tutor_screening_decisions d ON d.id=t.decision_id WHERE d.tutor_id=$1 ORDER BY t.check_code",
    ],
    response: [
      "SELECT to_jsonb(t) row FROM support_cases t WHERE id=$1",
      "SELECT to_jsonb(t) row FROM support_case_responses t WHERE case_id=$1",
      "SELECT to_jsonb(t) row FROM support_case_assignments t WHERE case_id=$1",
      "SELECT to_jsonb(t) row FROM support_case_events t WHERE case_id=$1 ORDER BY revision,action",
      "SELECT to_jsonb(t) row FROM support_assignment_events t WHERE case_id=$1 ORDER BY revision",
      "SELECT to_jsonb(t) row FROM support_response_events t WHERE case_id=$1 ORDER BY revision",
    ],
    access: [
      "SELECT to_jsonb(t) row FROM user_access t WHERE user_id=$1",
      "SELECT to_jsonb(t) row FROM account_restriction_targets t WHERE user_id=$1",
      "SELECT to_jsonb(t) row FROM account_restriction_events t WHERE target_user_id=$1 ORDER BY revision",
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
  it("valid READ COMMITTED commits once and exact replay preserves history", async () => {
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
      expect(saved.assurance).toEqual(before.assurance);
      await caller.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      expect(await callAndCommit(caller, f)).toEqual({
        outcome: "replayed",
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
        name === "record_tutor_screening_check"
          ? "SELECT * FROM public.record_tutor_screening_check(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)"
          : name === "change_safeguarding_response"
            ? "SELECT * FROM public.change_safeguarding_response(NULL,NULL,NULL,NULL,NULL,NULL,NULL)"
            : "SELECT * FROM public.change_safeguarding_access(NULL,NULL,NULL,NULL,NULL,NULL,NULL)";
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
