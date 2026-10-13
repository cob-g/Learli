import { refreshTestAdmin } from "../support/admin-mfa";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  openWorld,
  closeWorld,
  createAccount,
  password,
  type TestAccount,
  type World,
} from "./support";
import { screeningFixture, observedLock } from "./screening-fixtures";
import {
  recordScreeningCheck,
  decideScreening,
  readScreening,
} from "@/features/tutor-screening/service";
import { provisionScreeningAssignment } from "@/features/tutor-screening/fixture-tooling";
import {
  listEligibleTutors,
  findEligibleTutor,
} from "@/features/tutors/eligibility";
let w: World,
  reviewer: TestAccount,
  foreign: TestAccount,
  f: Awaited<ReturnType<typeof screeningFixture>>;
const check = (
  revision: number,
  code = "synthetic_check_a",
  overrides: Record<string, unknown> = {},
) => ({
  revision,
  code,
  requestKey: randomUUID(),
  outcome: "passed",
  reference: `screening:${randomUUID()}`,
  checkedAt: new Date(Date.now() - 60000).toISOString(),
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  ...overrides,
});
const decision = (
  revision: number,
  action = "approve",
  requestKey = randomUUID(),
) => ({ revision, action, requestKey });
beforeAll(async () => {
  w = openWorld();
  reviewer = await createAccount(w, ["admin"], "Fictional screening reviewer");
  foreign = await createAccount(w, ["admin"], "Unassigned fictional reviewer");
}, 60000);
beforeEach(async () => {
  f = await screeningFixture(w, reviewer);
}, 30000);
afterAll(async () => {
  await w.owner.pool.query(
    "UPDATE tutor_screening_policy_heads SET status='revoked'",
  );
  await closeWorld(w);
});
async function passed() {
  await recordScreeningCheck(
    f.context,
    reviewer.headers,
    f.profile.id,
    check(0),
  );
  await recordScreeningCheck(
    f.context,
    reviewer.headers,
    f.profile.id,
    check(1, "synthetic_check_b"),
  );
}
describe("current assigned evidence-based screening in actual PostgreSQL", () => {
  it("missing checks deny without changing status/head/history", async () => {
    await expect(
      decideScreening(f.context, reviewer.headers, f.profile.id, decision(0)),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await readScreening(f.context, reviewer.headers, f.profile.id),
    ).toMatchObject({ revision: 0, state: "pending" });
  });
  it("only complete current checks approve and discovery rejects any demo fallback", async () => {
    await passed();
    await decideScreening(
      f.context,
      reviewer.headers,
      f.profile.id,
      decision(2),
    );
    expect(
      await findEligibleTutor(
        w.runtime.db,
        f.profile.slug,
        "synthetic_readiness",
      ),
    ).toMatchObject({ slug: f.profile.slug });
    expect(await findEligibleTutor(w.runtime.db, f.profile.slug)).toBeNull();
    const dto = (
      await listEligibleTutors(w.runtime.db, {}, "synthetic_readiness")
    ).find((t) => t.slug === f.profile.slug)!;
    expect(JSON.stringify(dto)).not.toMatch(
      /screening:|policy:|tutorId|evidenceReference|checkCode/,
    );
  });
  it.each(["failed", "revoked"])(
    "%s current check cannot approve",
    async (outcome) => {
      await recordScreeningCheck(
        f.context,
        reviewer.headers,
        f.profile.id,
        check(0, "synthetic_check_a", { outcome }),
      );
      await recordScreeningCheck(
        f.context,
        reviewer.headers,
        f.profile.id,
        check(1, "synthetic_check_b"),
      );
      await expect(
        decideScreening(f.context, reviewer.headers, f.profile.id, decision(2)),
      ).rejects.toMatchObject({ status: 409 });
    },
  );
  it("expired evidence and future check time deny", async () => {
    await expect(
      recordScreeningCheck(
        f.context,
        reviewer.headers,
        f.profile.id,
        check(0, "synthetic_check_a", {
          checkedAt: new Date(Date.now() + 10000).toISOString(),
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    await recordScreeningCheck(
      f.context,
      reviewer.headers,
      f.profile.id,
      check(0, "synthetic_check_a", {
        checkedAt: new Date(Date.now() - 120000).toISOString(),
        expiresAt: new Date(Date.now() - 60000).toISOString(),
      }),
    );
    await recordScreeningCheck(
      f.context,
      reviewer.headers,
      f.profile.id,
      check(1, "synthetic_check_b"),
    );
    await expect(
      decideScreening(f.context, reviewer.headers, f.profile.id, decision(2)),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("evidence amendment removes the positive head before future discovery", async () => {
    await passed();
    await decideScreening(
      f.context,
      reviewer.headers,
      f.profile.id,
      decision(2),
    );
    await recordScreeningCheck(
      f.context,
      reviewer.headers,
      f.profile.id,
      check(3, "synthetic_check_a", { outcome: "revoked" }),
    );
    expect(
      await readScreening(f.context, reviewer.headers, f.profile.id),
    ).toMatchObject({ state: "pending", revision: 4 });
    expect(
      await findEligibleTutor(
        w.runtime.db,
        f.profile.slug,
        "synthetic_readiness",
      ),
    ).toBeNull();
    await expect(
      decideScreening(f.context, reviewer.headers, f.profile.id, decision(4)),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("suspension/revocation promptly removes shared eligibility and reinstatement needs evidence", async () => {
    await passed();
    await decideScreening(
      f.context,
      reviewer.headers,
      f.profile.id,
      decision(2),
    );
    await decideScreening(
      f.context,
      reviewer.headers,
      f.profile.id,
      decision(3, "suspend"),
    );
    expect(
      await findEligibleTutor(
        w.runtime.db,
        f.profile.slug,
        "synthetic_readiness",
      ),
    ).toBeNull();
    await recordScreeningCheck(
      f.context,
      reviewer.headers,
      f.profile.id,
      check(4, "synthetic_check_b", { outcome: "revoked" }),
    );
    await expect(
      decideScreening(
        f.context,
        reviewer.headers,
        f.profile.id,
        decision(5, "reinstate"),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("unassigned, own and role-only reviewers cannot read or mutate", async () => {
    await expect(
      recordScreeningCheck(f.context, foreign.headers, f.profile.id, check(0)),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      await readScreening(f.context, foreign.headers, f.profile.id),
    ).toBeNull();
    await expect(
      provisionScreeningAssignment(
        w.owner,
        f.profile.id,
        f.tutor.id,
        "synthetic_readiness",
        new Date(Date.now() + 60000),
      ),
    ).rejects.toThrow();
    await expect(
      decideScreening(f.context, f.tutor.headers, f.profile.id, decision(0)),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("idempotent complete request namespace denies differing and cross-action reuse", async () => {
    const input = check(0);
    expect(
      await recordScreeningCheck(
        f.context,
        reviewer.headers,
        f.profile.id,
        input,
      ),
    ).toMatchObject({ revision: 1, replayed: false });
    expect(
      await recordScreeningCheck(
        f.context,
        reviewer.headers,
        f.profile.id,
        input,
      ),
    ).toMatchObject({ revision: 1, replayed: true });
    await expect(
      recordScreeningCheck(f.context, reviewer.headers, f.profile.id, {
        ...input,
        outcome: "failed",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      decideScreening(
        f.context,
        reviewer.headers,
        f.profile.id,
        decision(1, "reject", input.requestKey),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("two independent concurrent positive decisions save one immutable head", async () => {
    await passed();
    const results = await Promise.allSettled([
      decideScreening(f.context, reviewer.headers, f.profile.id, decision(2)),
      decideScreening(f.context, reviewer.headers, f.profile.id, decision(2)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await readScreening(f.context, reviewer.headers, f.profile.id),
    ).toMatchObject({ revision: 3, state: "approved" });
  });
  it("same-key concurrent checks append exactly one receipt", async () => {
    const input = check(0);
    const results = await Promise.all([
      recordScreeningCheck(f.context, reviewer.headers, f.profile.id, input),
      recordScreeningCheck(f.context, reviewer.headers, f.profile.id, input),
    ]);
    expect(results.map((r) => r.replayed).sort()).toEqual([false, true]);
    const rows = await w.owner.pool.query(
      "SELECT count(*)::int n FROM tutor_screening_checks WHERE tutor_id=$1",
      [f.profile.id],
    );
    expect(rows.rows[0].n).toBe(1);
  });
  it("six-minute ordinary assurance works but current grant loss after tutor lock denies", async () => {
    await w.owner.pool.query(
      "UPDATE admin_assurance_receipts SET verified_at=clock_timestamp()-interval '6 minutes' WHERE user_id=$1",
      [reviewer.id],
    );
    await recordScreeningCheck(
      f.context,
      reviewer.headers,
      f.profile.id,
      check(0),
    );
    const lock = await w.owner.pool.connect();
    await lock.query("BEGIN");
    await lock.query("SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE", [
      f.profile.id,
    ]);
    const pending = recordScreeningCheck(
      f.context,
      reviewer.headers,
      f.profile.id,
      check(1, "synthetic_check_b"),
    );
    try {
      await observedLock(w, "record_tutor_screening_check");
      await w.owner.pool.query(
        "UPDATE tutor_screening_assignments SET status='revoked' WHERE tutor_id=$1",
        [f.profile.id],
      );
      await lock.query("COMMIT");
      await expect(pending).rejects.toMatchObject({ status: 404 });
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
    }
    expect(
      (
        await w.owner.pool.query(
          "SELECT revision FROM tutor_screening_cases WHERE tutor_id=$1",
          [f.profile.id],
        )
      ).rows[0].revision,
    ).toBe(1);
  });
  it("exact session receipt revocation during an observed domain wait denies", async () => {
    const lock = await w.owner.pool.connect();
    await lock.query("BEGIN");
    await lock.query("SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE", [
      f.profile.id,
    ]);
    const pending = recordScreeningCheck(
      f.context,
      reviewer.headers,
      f.profile.id,
      check(0),
    );
    try {
      await observedLock(w, "record_tutor_screening_check");
      await w.owner.pool.query(
        "UPDATE admin_security_epochs SET epoch=epoch+1 WHERE user_id=$1",
        [reviewer.id],
      );
      await lock.query("COMMIT");
      await expect(pending).rejects.toMatchObject({ status: 403 });
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
      await refreshTestAdmin(w.runtime, reviewer, password);
    }
  });
  it("actual receipt FK wait rechecks current MFA after writes and rolls back late denial", async () => {
    const lock = await w.owner.pool.connect();
    await lock.query("BEGIN");
    await lock.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
      reviewer.id,
    ]);
    const pending = recordScreeningCheck(
      f.context,
      reviewer.headers,
      f.profile.id,
      check(0),
    );
    const result = pending.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    try {
      await observedLock(w, "record_tutor_screening_check");
      await w.owner.pool.query(
        "UPDATE admin_security_epochs SET epoch=epoch+1 WHERE user_id=$1",
        [reviewer.id],
      );
      await lock.query("COMMIT");
      expect(await result).toMatchObject({ error: { status: 403 } });
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
      await refreshTestAdmin(w.runtime, reviewer, password);
    }
    expect(
      (
        await w.owner.pool.query(
          "SELECT revision FROM tutor_screening_cases WHERE tutor_id=$1",
          [f.profile.id],
        )
      ).rows[0].revision,
    ).toBe(0);
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM tutor_screening_checks WHERE tutor_id=$1",
          [f.profile.id],
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it("direct runtime status/provenance/check/history/policy writes and marker erasure are denied", async () => {
    for (const query of [
      "UPDATE tutor_profiles SET review_status='approved' WHERE id=$1",
      "DELETE FROM tutor_screening_cases WHERE tutor_id=$1",
      "UPDATE tutor_screening_cases SET state='approved' WHERE tutor_id=$1",
      "DELETE FROM tutor_screening_checks WHERE tutor_id=$1",
      "UPDATE tutor_screening_assignments SET status='revoked' WHERE tutor_id=$1",
    ]) {
      await expect(
        w.runtime.pool.query(query, [f.profile.id]),
      ).rejects.toMatchObject({ code: "42501" });
    }
    await expect(
      w.owner.pool.query(
        "DELETE FROM tutor_screening_cases WHERE tutor_id=$1",
        [f.profile.id],
      ),
    ).rejects.toMatchObject({ code: "55000" });
  });
  it("invalid/operational scopes fail closed and policy revocation removes eligibility", async () => {
    await passed();
    await decideScreening(
      f.context,
      reviewer.headers,
      f.profile.id,
      decision(2),
    );
    for (const scope of ["operational", "forged", null])
      expect(
        (
          await w.runtime.pool.query(
            "SELECT has_current_tutor_screening($1,$2) allowed",
            [f.profile.id, scope],
          )
        ).rows[0].allowed,
      ).toBe(false);
    await w.owner.pool.query(
      "UPDATE tutor_screening_policy_heads SET status='revoked'",
    );
    expect(
      await findEligibleTutor(
        w.runtime.db,
        f.profile.slug,
        "synthetic_readiness",
      ),
    ).toBeNull();
  });
});
