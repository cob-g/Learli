import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  createAdmission,
  readAssignedAdmission,
  mutateAdmissionReview,
} from "@/features/learner-admission/service";
import {
  recordScreeningCheck,
  decideScreening,
} from "@/features/tutor-screening/service";
import {
  provisionAdmissionPolicy,
  assignAdmissionReviewer,
} from "../support/learner-admission-fixtures";
import { screeningFixture } from "./screening-fixtures";
import {
  openWorld,
  closeWorld,
  createAccount,
  type World,
  type TestAccount,
} from "./support";

let world: World;
beforeAll(() => {
  world = openWorld();
});
afterAll(async () => {
  await world.owner.pool.query(
    "UPDATE tutor_screening_policy_heads SET status='revoked'",
  );
  await closeWorld(world);
});
async function session(actor: TestAccount) {
  const value = await world.runtime.auth.api.getSession({
    headers: actor.headers,
  });
  if (!value) throw new Error("Actual fixture session required.");
  return value.session.id;
}
async function admissionFixture() {
  const cap = await provisionAdmissionPolicy(world.owner.pool);
  const family = await createAccount(world);
  const reviewer = await createAccount(world, ["admin"]);
  const context = { runtime: world.runtime, admission: cap };
  const admission = await createAdmission(context, family.headers, {
    requestId: randomUUID(),
    management: "guardian",
    displayName: "Fictional isolation learner",
    level: "elementary",
    timezone: "Asia/Manila",
    policyVersion: cap.version,
    policyDigest: cap.contentDigest,
  });
  await assignAdmissionReviewer(world.owner.pool, admission.id, reviewer.id);
  let assigned = await readAssignedAdmission(
    context,
    reviewer.headers,
    admission.id,
  );
  for (const checkCode of ["guardian_authority", "guardian_notice"])
    assigned = await mutateAdmissionReview(
      context,
      reviewer.headers,
      admission.id,
      "evidence",
      {
        requestId: randomUUID(),
        revision: assigned.revision,
        checkCode,
        reference: `synthetic:${randomUUID()}`,
      },
    );
  return {
    context,
    family,
    reviewer,
    admission,
    assigned,
    sid: await session(reviewer),
  };
}
async function readyScreening() {
  const reviewer = await createAccount(world, ["admin"]);
  const fixture = await screeningFixture(world, reviewer);
  for (const [revision, code] of [
    [0, "synthetic_check_a"],
    [1, "synthetic_check_b"],
  ] as const)
    await recordScreeningCheck(
      fixture.context,
      reviewer.headers,
      fixture.profile.id,
      {
        revision,
        code,
        requestKey: randomUUID(),
        outcome: "passed",
        reference: `screening:${randomUUID()}`,
        checkedAt: new Date(Date.now() - 60000).toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    );
  return { ...fixture, reviewer, sid: await session(reviewer) };
}
async function admissionState(f: Awaited<ReturnType<typeof admissionFixture>>) {
  const result = await world.owner.pool.query(
    `
    SELECT to_jsonb(a) AS admission,to_jsonb(l) AS learner,
      (SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.guardian_user_id),'[]') FROM guardian_learner_links g WHERE g.learner_id=l.id) AS links,
      (SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.revision),'[]') FROM learner_admission_events e WHERE e.admission_id=a.id) AS events,
      (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.role),'[]') FROM user_roles r WHERE r.user_id=a.requester_user_id) AS roles
    FROM learner_admissions a JOIN learner_profiles l ON l.id=a.learner_id WHERE a.id=$1`,
    [f.admission.id],
  );
  return result.rows[0];
}
async function screeningState(f: Awaited<ReturnType<typeof readyScreening>>) {
  const result = await world.owner.pool.query(
    `
    SELECT to_jsonb(t) AS tutor,to_jsonb(c) AS screening,
      (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.revision),'[]') FROM tutor_screening_decisions d WHERE d.tutor_id=t.id) AS decisions,
      (SELECT coalesce(jsonb_agg(to_jsonb(dc) ORDER BY dc.check_code),'[]') FROM tutor_screening_decision_checks dc JOIN tutor_screening_decisions d ON d.id=dc.decision_id WHERE d.tutor_id=t.id) AS decision_checks,
      (SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.revision),'[]') FROM tutor_screening_events e WHERE e.tutor_id=t.id) AS events,
      (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]') FROM audit_events a WHERE a.target_user_id=t.user_id) AS audit
    FROM tutor_profiles t JOIN tutor_screening_cases c ON c.tutor_id=t.id WHERE t.id=$1`,
    [f.profile.id],
  );
  return result.rows[0];
}
async function revokeAdminAfterSnapshot(
  caller: PoolClient,
  reviewer: TestAccount,
) {
  const query =
    "SELECT count(*)::int AS n FROM user_roles WHERE user_id=$1 AND role='admin'";
  expect((await caller.query(query, [reviewer.id])).rows[0].n).toBe(1);
  await world.owner.pool.query(
    "DELETE FROM user_roles WHERE user_id=$1 AND role='admin'",
    [reviewer.id],
  );
  expect((await world.owner.pool.query(query, [reviewer.id])).rows[0].n).toBe(
    0,
  );
  // The caller still observes the old role. This is the exact stale snapshot trigger,
  // not a forged actor, missing evidence or expired provider session.
  expect((await caller.query(query, [reviewer.id])).rows[0].n).toBe(1);
}
async function outcome(caller: PoolClient, sql: string, values: unknown[]) {
  try {
    const result = await caller.query(sql, values);
    // Commit unexpected success so the red run demonstrates actual side effects.
    await caller.query("COMMIT");
    return { outcome: result.rows[0]?.outcome, code: null };
  } catch (error) {
    await caller.query("ROLLBACK");
    return {
      outcome: null,
      code:
        error && typeof error === "object" && "code" in error
          ? error.code
          : null,
    };
  }
}
const admissionSql =
  "SELECT * FROM public.decide_learner_admission($1,$2,$3::uuid,$4,$5::uuid,'authorize')";
const screeningSql =
  "SELECT * FROM public.decide_tutor_screening($1,$2,$3::uuid,2,$4::uuid,'approve')";
const modes = ["REPEATABLE READ", "SERIALIZABLE"] as const;
describe("granted decision SQL requires current READ COMMITTED authority", () => {
  it.each(modes)(
    "admission rejects %s stale revoked-admin snapshot without any effects; exact service refuses403",
    async (mode) => {
      const f = await admissionFixture(),
        before = await admissionState(f),
        caller = await world.runtime.pool.connect();
      try {
        await caller.query(`BEGIN ISOLATION LEVEL ${mode}`);
        await revokeAdminAfterSnapshot(caller, f.reviewer);
        await expect(
          mutateAdmissionReview(
            f.context,
            f.reviewer.headers,
            f.admission.id,
            "decision",
            {
              requestId: randomUUID(),
              revision: f.assigned.revision,
              action: "authorize",
            },
          ),
        ).rejects.toMatchObject({ status: 403 });
        const result = await outcome(caller, admissionSql, [
          f.reviewer.id,
          f.sid,
          f.admission.id,
          f.assigned.revision,
          randomUUID(),
        ]);
        expect.soft(result).toEqual({ outcome: null, code: "25001" });
        expect(await admissionState(f)).toEqual(before);
      } finally {
        await caller.query("ROLLBACK");
        caller.release();
      }
    },
    30000,
  );
  it.each(modes)(
    "screening rejects %s stale revoked-admin snapshot without any effects; exact service refuses403",
    async (mode) => {
      const f = await readyScreening(),
        before = await screeningState(f),
        caller = await world.runtime.pool.connect();
      try {
        await caller.query(`BEGIN ISOLATION LEVEL ${mode}`);
        await revokeAdminAfterSnapshot(caller, f.reviewer);
        await expect(
          decideScreening(f.context, f.reviewer.headers, f.profile.id, {
            revision: 2,
            requestKey: randomUUID(),
            action: "approve",
          }),
        ).rejects.toMatchObject({ status: 403 });
        const result = await outcome(caller, screeningSql, [
          f.reviewer.id,
          f.sid,
          f.profile.id,
          randomUUID(),
        ]);
        expect.soft(result).toEqual({ outcome: null, code: "25001" });
        expect(await screeningState(f)).toEqual(before);
      } finally {
        await caller.query("ROLLBACK");
        caller.release();
      }
    },
    30000,
  );
  it("valid READ COMMITTED admission still commits the same decision, learner, role, link and event", async () => {
    const f = await admissionFixture(),
      before = await admissionState(f),
      caller = await world.runtime.pool.connect();
    try {
      await caller.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      expect(
        await outcome(caller, admissionSql, [
          f.reviewer.id,
          f.sid,
          f.admission.id,
          f.assigned.revision,
          randomUUID(),
        ]),
      ).toEqual({ outcome: "decided", code: null });
      const after = await admissionState(f);
      expect(after.admission).toMatchObject({
        state: "authorized",
        revision: f.assigned.revision + 1,
      });
      expect(after.learner.status).toBe("active");
      expect(after.links).toMatchObject([
        { guardian_user_id: f.family.id, status: "authorized" },
      ]);
      expect(after.roles).toMatchObject([{ role: "parent" }]);
      expect(after.events).toHaveLength(before.events.length + 1);
    } finally {
      await caller.query("ROLLBACK");
      caller.release();
    }
  }, 30000);
  it("valid READ COMMITTED screening still commits the same approval and required-check receipts", async () => {
    const f = await readyScreening(),
      before = await screeningState(f),
      caller = await world.runtime.pool.connect();
    try {
      await caller.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      expect(
        await outcome(caller, screeningSql, [
          f.reviewer.id,
          f.sid,
          f.profile.id,
          randomUUID(),
        ]),
      ).toEqual({ outcome: "saved", code: null });
      const after = await screeningState(f);
      expect(after.tutor.review_status).toBe("approved");
      expect(after.screening).toMatchObject({ state: "approved", revision: 3 });
      expect(after.decisions).toMatchObject([
        { action: "approve", revision: 3 },
      ]);
      expect(after.decision_checks).toHaveLength(2);
      expect(after.events).toHaveLength(before.events.length + 1);
      expect(after.audit).toHaveLength(before.audit.length + 1);
    } finally {
      await caller.query("ROLLBACK");
      caller.release();
    }
  }, 30000);
  it.each(["REPEATABLE READ", "SERIALIZABLE", "READ UNCOMMITTED"] as const)(
    "refuses %s before argument validation or domain work",
    async (mode) => {
      for (const sql of [admissionSql, screeningSql]) {
        const caller = await world.runtime.pool.connect();
        try {
          await caller.query(`BEGIN ISOLATION LEVEL ${mode}`);
          await expect(
            caller.query(
              sql,
              sql === admissionSql
                ? [null, null, null, null, null]
                : [null, null, null, null],
            ),
          ).rejects.toMatchObject({ code: "25001" });
        } finally {
          await caller.query("ROLLBACK");
          caller.release();
        }
      }
    },
  );
});
