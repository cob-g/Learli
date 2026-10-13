import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import {
  openWorld,
  closeWorld,
  createAccount,
  type World,
  type TestAccount,
} from "./support";
import { screeningFixture, observedLock } from "./screening-fixtures";
import {
  decideScreening,
  recordScreeningCheck,
} from "@/features/tutor-screening/service";
let w: World,
  reviewer: TestAccount,
  f: Awaited<ReturnType<typeof screeningFixture>>;
beforeAll(async () => {
  w = openWorld();
  reviewer = await createAccount(w, ["admin"], "Fictional expiry reviewer");
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
async function checks(revision: number, expiresAt: string) {
  for (const [offset, code] of [
    "synthetic_check_a",
    "synthetic_check_b",
  ].entries())
    await recordScreeningCheck(f.context, reviewer.headers, f.profile.id, {
      revision: revision + offset,
      code,
      outcome: "passed",
      reference: "screening:" + randomUUID(),
      checkedAt: new Date(Date.now() - 60000).toISOString(),
      expiresAt,
      requestKey: randomUUID(),
    });
}
async function waitThrough(expiresAt: string) {
  await w.owner.pool.query(
    "SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM $1::timestamptz-clock_timestamp())+0.05))",
    [expiresAt],
  );
}
it.each(["approve", "reinstate"] as const)(
  "positive %s actual actor FK wait past required receipt expiry rolls back entire decision",
  async (action) => {
    let revision = 0,
      state = "pending",
      profileStatus = "pending";
    if (action === "reinstate") {
      await checks(0, new Date(Date.now() + 3600000).toISOString());
      await decideScreening(f.context, reviewer.headers, f.profile.id, {
        revision: 2,
        action: "approve",
        requestKey: randomUUID(),
      });
      await decideScreening(f.context, reviewer.headers, f.profile.id, {
        revision: 3,
        action: "suspend",
        requestKey: randomUUID(),
      });
      revision = 4;
      state = "suspended";
      profileStatus = "suspended";
    }
    const expiresAt = new Date(Date.now() + 4000).toISOString();
    await checks(revision, expiresAt);
    revision += 2;
    const prior = (
        await w.owner.pool.query(
          "SELECT current_decision_id FROM tutor_screening_cases WHERE tutor_id=$1",
          [f.profile.id],
        )
      ).rows[0].current_decision_id,
      priorDecisions = (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM tutor_screening_decisions WHERE tutor_id=$1",
          [f.profile.id],
        )
      ).rows[0].n,
      lock = await w.owner.pool.connect();
    await lock.query("BEGIN");
    await lock.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
      reviewer.id,
    ]);
    const result = decideScreening(f.context, reviewer.headers, f.profile.id, {
      revision,
      action,
      requestKey: randomUUID(),
    }).then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    try {
      await observedLock(w, "decide_tutor_screening");
      await waitThrough(expiresAt);
      await lock.query("COMMIT");
      expect(await result).toMatchObject({ error: { status: 409 } });
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
    }
    expect(
      (
        await w.owner.pool.query(
          "SELECT state,revision,current_decision_id FROM tutor_screening_cases WHERE tutor_id=$1",
          [f.profile.id],
        )
      ).rows[0],
    ).toEqual({ state, revision, current_decision_id: prior });
    expect(
      (
        await w.owner.pool.query(
          "SELECT review_status FROM tutor_profiles WHERE id=$1",
          [f.profile.id],
        )
      ).rows[0].review_status,
    ).toBe(profileStatus);
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM tutor_screening_decisions WHERE tutor_id=$1",
          [f.profile.id],
        )
      ).rows[0].n,
    ).toBe(priorDecisions);
  },
);
it("actual nested PLpgSQL after a lock wait uses current database time for eligibility", async () => {
  const expiresAt = new Date(Date.now() + 4000).toISOString();
  await checks(0, expiresAt);
  await decideScreening(f.context, reviewer.headers, f.profile.id, {
    revision: 2,
    action: "approve",
    requestKey: randomUUID(),
  });
  expect(
    (
      await w.runtime.pool.query(
        "SELECT public.has_current_tutor_screening($1,'synthetic_readiness') allowed",
        [f.profile.id],
      )
    ).rows[0].allowed,
  ).toBe(true);
  const lock = await w.owner.pool.connect(),
    reader = await w.owner.pool.connect();
  await lock.query("BEGIN");
  await lock.query("SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE", [
    f.profile.id,
  ]);
  const pid = (await reader.query("SELECT pg_backend_pid() pid")).rows[0].pid;
  await reader.query(
    "CREATE FUNCTION pg_temp.w8_after_wait(p_tutor uuid) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN PERFORM 1 FROM public.tutor_profiles WHERE id=p_tutor FOR SHARE; RETURN public.has_current_tutor_screening(p_tutor,'synthetic_readiness'); END; $$",
  );
  const result = reader.query("SELECT pg_temp.w8_after_wait($1) allowed", [
    f.profile.id,
  ]);
  try {
    const until = Date.now() + 5000;
    let observed = false;
    while (Date.now() < until) {
      if (
        (
          await w.owner.pool.query(
            "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock') waiting",
            [pid],
          )
        ).rows[0].waiting
      ) {
        observed = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    expect(observed).toBe(true);
    await waitThrough(expiresAt);
    await lock.query("COMMIT");
    expect((await result).rows[0].allowed).toBe(false);
  } finally {
    await lock.query("ROLLBACK");
    lock.release();
    reader.release();
  }
});
