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
  requestScreening,
  decideScreening,
} from "@/features/tutor-screening/service";
import { saveOwnTutorProfile } from "@/features/tutors/service";
import { requireRole } from "@/lib/permissions/access";
import {
  provisionScreeningPolicy,
  selectScreeningPolicy,
} from "@/features/tutor-screening/fixture-tooling";
let w: World,
  reviewer: TestAccount,
  f: Awaited<ReturnType<typeof screeningFixture>>;
beforeAll(async () => {
  w = openWorld();
  reviewer = await createAccount(w, ["admin"], "Fictional last wait reviewer");
}, 60000);
beforeEach(async () => {
  f = await screeningFixture(w, reviewer, false);
}, 30000);
afterAll(async () => {
  await w.owner.pool.query(
    "UPDATE tutor_screening_policy_heads SET status='revoked'",
  );
  await closeWorld(w);
});
it.each(["role", "session", "access", "verification"] as const)(
  "enrollment actual event FK wait denies late %s loss with no permanent marker",
  async (kind) => {
    const identity = await requireRole(w.runtime, f.tutor.headers, "tutor"),
      lock = await w.owner.pool.connect();
    await lock.query("BEGIN");
    await lock.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
      f.tutor.id,
    ]);
    const result = requestScreening(f.context, f.tutor.headers, f.profile.id, {
      requestKey: randomUUID(),
    }).then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    try {
      await observedLock(w, "request_tutor_screening");
      if (kind === "role")
        await w.owner.pool.query(
          "DELETE FROM user_roles WHERE user_id=$1 AND role='tutor'",
          [f.tutor.id],
        );
      else if (kind === "session")
        await w.owner.pool.query(
          "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
          [identity.sessionId],
        );
      else if (kind === "access")
        await w.owner.pool.query(
          "UPDATE user_access SET status='suspended' WHERE user_id=$1",
          [f.tutor.id],
        );
      else
        await lock.query('UPDATE "user" SET email_verified=false WHERE id=$1', [
          f.tutor.id,
        ]);
      await lock.query("COMMIT");
      expect(await result).toMatchObject({ error: { status: 403 } });
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
    }
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM tutor_screening_cases WHERE tutor_id=$1",
          [f.profile.id],
        )
      ).rows[0].n,
    ).toBe(0);
    expect(
      (
        await w.owner.pool.query(
          "SELECT count(*)::int n FROM tutor_screening_events WHERE tutor_id=$1",
          [f.profile.id],
        )
      ).rows[0].n,
    ).toBe(0);
  },
);
it("enrollment policy expiration during observed event FK wait rolls back marker and event", async () => {
  const packet = {
    ...f.policy,
    version: "expiry-" + randomUUID(),
    validUntil: new Date(Date.now() + 2000).toISOString(),
  };
  await provisionScreeningPolicy(w.owner, packet);
  await selectScreeningPolicy(w.owner, packet.version);
  const lock = await w.owner.pool.connect();
  await lock.query("BEGIN");
  await lock.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
    f.tutor.id,
  ]);
  const result = requestScreening(
    { ...f.context, screening: packet },
    f.tutor.headers,
    f.profile.id,
    { requestKey: randomUUID() },
  ).then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  try {
    await observedLock(w, "request_tutor_screening");
    await w.owner.pool.query(
      "SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM $1::timestamptz-clock_timestamp())+0.05))",
      [packet.validUntil],
    );
    await lock.query("COMMIT");
    expect(await result).toMatchObject({ error: { status: 503 } });
  } finally {
    await lock.query("ROLLBACK");
    lock.release();
  }
  expect(
    (
      await w.owner.pool.query(
        "SELECT count(*)::int n FROM tutor_screening_cases WHERE tutor_id=$1",
        [f.profile.id],
      )
    ).rows[0].n,
  ).toBe(0);
  expect(
    (
      await w.owner.pool.query(
        "SELECT count(*)::int n FROM tutor_screening_events WHERE tutor_id=$1",
        [f.profile.id],
      )
    ).rows[0].n,
  ).toBe(0);
});
it("direct readiness resubmission last FK wait denies current tutor role loss and preserves rejected round", async () => {
  const enrolled = await screeningFixture(w, reviewer);
  await decideScreening(
    enrolled.context,
    reviewer.headers,
    enrolled.profile.id,
    { revision: 0, requestKey: randomUUID(), action: "reject" },
  );
  const identity = await requireRole(
      w.runtime,
      enrolled.tutor.headers,
      "tutor",
    ),
    lock = await w.owner.pool.connect();
  await lock.query("BEGIN");
  await lock.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
    enrolled.tutor.id,
  ]);
  const result = w.runtime.pool.query(
    "SELECT public.resubmit_tutor_application($1,$2,$3) allowed",
    [identity.userId, identity.sessionId, enrolled.profile.id],
  );
  try {
    await observedLock(w, "resubmit_tutor_application");
    await w.owner.pool.query(
      "DELETE FROM user_roles WHERE user_id=$1 AND role='tutor'",
      [enrolled.tutor.id],
    );
    await lock.query("COMMIT");
    expect((await result).rows[0].allowed).toBe(false);
  } finally {
    await lock.query("ROLLBACK");
    lock.release();
  }
  expect(
    (
      await w.owner.pool.query(
        "SELECT state,round,revision FROM tutor_screening_cases WHERE tutor_id=$1",
        [enrolled.profile.id],
      )
    ).rows[0],
  ).toEqual({ state: "rejected", round: 1, revision: 1 });
  expect(
    (
      await w.owner.pool.query(
        "SELECT review_status FROM tutor_profiles WHERE id=$1",
        [enrolled.profile.id],
      )
    ).rows[0].review_status,
  ).toBe("rejected");
  expect(
    (
      await w.owner.pool.query(
        "SELECT count(*)::int n FROM tutor_screening_events WHERE tutor_id=$1 AND kind='request'",
        [enrolled.profile.id],
      )
    ).rows[0].n,
  ).toBe(1);
});
it("outer profile edit audit FK wait rechecks current tutor role and rolls back all profile fields", async () => {
  await w.owner.pool.query(
    "UPDATE tutor_profiles SET review_status='approved' WHERE id=$1",
    [f.profile.id],
  );
  const subject = (
      await w.owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
    ).rows[0].id,
    lock = await w.owner.pool.connect();
  await lock.query("BEGIN");
  await lock.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
    f.tutor.id,
  ]);
  const result = saveOwnTutorProfile(w.runtime, f.tutor.headers, {
    headline: "Fictional changed headline",
    bio: "Fictional changed introduction",
    teachingBackground: "Fictional changed background",
    timezone: "Asia/Manila",
    offerings: [{ subjectId: subject, levels: ["college_support"] }],
  }).then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  try {
    await observedLock(w, "audit_events");
    await w.owner.pool.query(
      "DELETE FROM user_roles WHERE user_id=$1 AND role='tutor'",
      [f.tutor.id],
    );
    await lock.query("COMMIT");
    expect(await result).toMatchObject({ error: { status: 403 } });
  } finally {
    await lock.query("ROLLBACK");
    lock.release();
  }
  expect(
    (
      await w.owner.pool.query(
        "SELECT headline,review_status FROM tutor_profiles WHERE id=$1",
        [f.profile.id],
      )
    ).rows[0],
  ).toEqual({ headline: f.profile.headline, review_status: "approved" });
});
