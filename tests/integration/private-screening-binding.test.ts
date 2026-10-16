import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Pool, PoolClient } from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { localDatabaseConfig } from "@/lib/db/local-config";
import { bookingPolicyDigest } from "@/features/booking-workflows/policy";
import {
  provisionScreeningPolicy,
  selectScreeningPolicy,
} from "@/features/tutor-screening/fixture-tooling";
import {
  decideScreening,
  readScreening,
  recordScreeningCheck,
  requestScreening,
  type ScreeningContext,
} from "@/features/tutor-screening/service";
import type { ScreeningCapability } from "@/features/tutor-screening/policy";
import { syntheticAdmissionPolicy } from "../support/learner-admission-fixtures";
import {
  closeWorld,
  createAccount,
  openWorld,
  type TestAccount,
  type World,
} from "./support";
import { observedLock, screeningFixture } from "./screening-fixtures";

type EnabledScreening = Exclude<ScreeningCapability, { mode: "disabled" }>;
let w: World,
  reviewer: TestAccount,
  f: Awaited<ReturnType<typeof screeningFixture>>,
  directory: string,
  priorHead: { version: string; status: string } | undefined;
const check = (revision = 0) => ({
  revision,
  code: "synthetic_check_a",
  requestKey: randomUUID(),
  outcome: "passed",
  reference: `screening:${randomUUID()}`,
  checkedAt: new Date(Date.now() - 60_000).toISOString(),
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
});
beforeAll(async () => {
  vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
  w = openWorld();
  priorHead = (
    await w.owner.pool.query<{ version: string; status: string }>(
      "SELECT version,status FROM tutor_screening_policy_heads WHERE provenance='synthetic_readiness'",
    )
  ).rows[0];
  reviewer = await createAccount(w, ["admin"], "Private screening reviewer");
  const local = path.join(process.cwd(), ".local");
  mkdirSync(local, { recursive: true, mode: 0o700 });
  directory = mkdtempSync(path.join(local, "private-screening-binding-"));
}, 60_000);
beforeEach(async () => {
  vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
  f = await screeningFixture(w, reviewer);
}, 30_000);
afterAll(async () => {
  vi.unstubAllEnvs();
  try {
    if (priorHead)
      await w.owner.pool.query(
        "UPDATE tutor_screening_policy_heads SET version=$1,status=$2 WHERE provenance='synthetic_readiness'",
        [priorHead.version, priorHead.status],
      );
    else
      await w?.owner.pool.query(
        "UPDATE tutor_screening_policy_heads SET status='revoked' WHERE provenance='synthetic_readiness'",
      );
  } finally {
    await closeWorld(w);
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});
function policy(): EnabledScreening {
  return f.policy;
}
function activate(
  screening: EnabledScreening = policy(),
  emails = [reviewer.email, f.tutor.email],
): ScreeningContext {
  const configured = localDatabaseConfig(process.env.DATABASE_URL, true);
  const admission = syntheticAdmissionPolicy(randomUUID());
  const terms = {
    authority: "synthetic_test",
    source: "synthetic_readiness",
    version: "synthetic-booking-v2",
    reference: "synthetic:booking:v2",
    admissionPolicyId: admission.policyId,
    durationMinutes: 60,
    stepMinutes: 30,
    noticeMinutes: 60,
    horizonDays: 14,
    provisionalMinutes: 10,
    cancelCutoffMinutes: 60,
    moveCutoffMinutes: 60,
    confirmationPrerequisite: "synthetic_prerequisite_review",
    confirmationActor: "assigned_mfa_admin",
    outcomeActor: "assigned_mfa_admin",
    disputePath: "/support",
    meetingAccess: "confirmed_until_end",
    completionActor: "assigned_tutor",
  } as const;
  const file = path.join(directory, "workflow.json");
  writeFileSync(
    file,
    JSON.stringify({
      version: 1,
      purpose: "private_fictional_workflow",
      audience: "fictional_only",
      realIntake: "disabled",
      payments: "disabled",
      origin: w.runtime.origin,
      accountEmails: emails,
      database: {
        mode: "local-test",
        host: configured.host,
        port: configured.port,
        database: "learli_test",
        runtimeRole: "learli_app",
      },
      admission,
      screening,
      booking: {
        ...terms,
        policyId: randomUUID(),
        contentDigest: bookingPolicyDigest(terms),
      },
    }),
    { mode: 0o600 },
  );
  vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", file);
  return { runtime: w.runtime, screening };
}
async function snapshot(connection: Pool | PoolClient = w.owner.pool) {
  return (
    await connection.query(
      `SELECT jsonb_build_object(
        'case',(SELECT to_jsonb(c) FROM tutor_screening_cases c WHERE c.tutor_id=$1),
        'profile',(SELECT to_jsonb(t) FROM tutor_profiles t WHERE t.id=$1),
        'checks',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') FROM tutor_screening_checks c WHERE c.tutor_id=$1),
        'decisions',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id),'[]') FROM tutor_screening_decisions d WHERE d.tutor_id=$1),
        'events',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]') FROM tutor_screening_events e WHERE e.tutor_id=$1),
        'audit',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]') FROM audit_events a JOIN tutor_profiles t ON t.user_id=a.target_user_id WHERE t.id=$1)
      ) AS state`,
      [f.profile.id],
    )
  ).rows[0].state;
}
async function alternatePolicy() {
  const p = { ...policy(), version: `private-${randomUUID()}` };
  await provisionScreeningPolicy(w.owner, p);
  return p;
}

describe("private screening policy and membership binding in PostgreSQL", () => {
  it("keeps matching current checks, decisions, reads and same-policy retries working", async () => {
    const context = activate();
    const input = check();
    expect(
      await recordScreeningCheck(
        context,
        reviewer.headers,
        f.profile.id,
        input,
      ),
    ).toEqual({ revision: 1, replayed: false });
    expect(
      await recordScreeningCheck(
        context,
        reviewer.headers,
        f.profile.id,
        input,
      ),
    ).toEqual({ revision: 1, replayed: true });
    expect(
      await readScreening(context, reviewer.headers, f.profile.id),
    ).toMatchObject({
      revision: 1,
      state: "pending",
      requiredCodes: policy().requiredCheckCodes,
    });
    expect(
      await decideScreening(context, reviewer.headers, f.profile.id, {
        revision: 1,
        requestKey: randomUUID(),
        action: "reject",
      }),
    ).toEqual({ revision: 2, replayed: false });
    expect(
      await readScreening(context, f.tutor.headers, f.profile.id, "owner"),
    ).toMatchObject({ revision: 2, state: "rejected" });
  });
  it("rolls back check, decision, profile, event and audit writes when packet A sees current case B", async () => {
    const a = await alternatePolicy();
    const before = await snapshot();
    const context = activate(a);
    await expect(
      recordScreeningCheck(context, reviewer.headers, f.profile.id, check()),
    ).rejects.toMatchObject({ status: 503 });
    expect(await snapshot()).toEqual(before);
    await expect(
      decideScreening(context, reviewer.headers, f.profile.id, {
        revision: 0,
        requestKey: randomUUID(),
        action: "reject",
      }),
    ).rejects.toMatchObject({ status: 503 });
    expect(await snapshot()).toEqual(before);
    expect(
      await readScreening(context, reviewer.headers, f.profile.id),
    ).toBeNull();
    expect(
      await readScreening(context, f.tutor.headers, f.profile.id, "owner"),
    ).toBeNull();
    // Existing local semantics still read B when no private packet is selected.
    vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
    expect(
      await readScreening(f.context, reviewer.headers, f.profile.id),
    ).toMatchObject({ revision: 0, state: "pending" });
  });
  it("matches immutable policy terms as well as the version label", async () => {
    const before = await snapshot();
    const context = activate({
      ...policy(),
      authorityReference: `synthetic:${randomUUID()}`,
    });
    await expect(
      recordScreeningCheck(context, reviewer.headers, f.profile.id, check()),
    ).rejects.toMatchObject({ status: 503 });
    expect(await snapshot()).toEqual(before);
    expect(
      await readScreening(context, reviewer.headers, f.profile.id),
    ).toBeNull();
  });
  it("checks the exact policy after a real profile wait and rolls back a B write after an A preflight", async () => {
    const a = policy(),
      b = await alternatePolicy();
    const context = activate(a);
    const session = await w.runtime.auth.api.getSession({
      headers: reviewer.headers,
    });
    if (!session) throw new Error("Expected actual reviewer session.");
    const lock = await w.owner.pool.connect();
    await lock.query("BEGIN");
    await lock.query("SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE", [
      f.profile.id,
    ]);
    const pending = recordScreeningCheck(
      context,
      reviewer.headers,
      f.profile.id,
      check(1),
    );
    const settled = pending.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    try {
      await observedLock(w, "record_tutor_screening_check");
      await selectScreeningPolicy(w.owner, b.version);
      const migrated = await lock.query(
        "SELECT * FROM public.decide_tutor_screening($1,$2,$3::uuid,0,$4::uuid,'reopen')",
        [reviewer.id, session.session.id, f.profile.id, randomUUID()],
      );
      expect(migrated.rows[0]).toEqual({ outcome: "saved", revision: 1 });
      const before = await snapshot(lock);
      await lock.query("COMMIT");
      expect(await settled).toMatchObject({ error: { status: 503 } });
      expect(await snapshot()).toEqual(before);
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
      await settled;
    }
  });
  it.each(["actor", "tutor"] as const)(
    "rechecks the current %s email against finite membership after a real wait",
    async (member) => {
      const context = activate(),
        before = await snapshot();
      const actor = member === "actor" ? reviewer : f.tutor;
      const lock = await w.owner.pool.connect();
      await lock.query("BEGIN");
      await lock.query("SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE", [
        f.profile.id,
      ]);
      const settled = recordScreeningCheck(
        context,
        reviewer.headers,
        f.profile.id,
        check(),
      ).then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      try {
        await observedLock(w, "record_tutor_screening_check");
        await w.owner.pool.query('UPDATE "user" SET email=$1 WHERE id=$2', [
          `outside-${randomUUID()}@learli.test`,
          actor.id,
        ]);
        await lock.query("COMMIT");
        expect(await settled).toMatchObject({ error: { status: 503 } });
        expect(await snapshot()).toEqual(before);
      } finally {
        await lock.query("ROLLBACK");
        lock.release();
        await settled;
        await w.owner.pool.query('UPDATE "user" SET email=$1 WHERE id=$2', [
          actor.email,
          actor.id,
        ]);
      }
    },
  );
  it("does not expose or mutate an assigned tutor outside the private packet", async () => {
    const context = activate(policy(), [reviewer.email]);
    const before = await snapshot();
    expect(
      await readScreening(context, reviewer.headers, f.profile.id),
    ).toBeNull();
    await expect(
      recordScreeningCheck(context, reviewer.headers, f.profile.id, check()),
    ).rejects.toMatchObject({ status: 503 });
    expect(await snapshot()).toEqual(before);
  });
  it("cannot return a replay receipt from policy B after the case moves to packet policy A", async () => {
    const input = check();
    await recordScreeningCheck(
      f.context,
      reviewer.headers,
      f.profile.id,
      input,
    );
    const a = await alternatePolicy();
    await selectScreeningPolicy(w.owner, a.version);
    const context = { runtime: w.runtime, screening: a };
    await decideScreening(context, reviewer.headers, f.profile.id, {
      revision: 1,
      requestKey: randomUUID(),
      action: "reopen",
    });
    const before = await snapshot();
    activate(a);
    await expect(
      recordScreeningCheck(context, reviewer.headers, f.profile.id, input),
    ).rejects.toMatchObject({ status: 503 });
    expect(await snapshot()).toEqual(before);
  });
  it("keeps an allowlisted owner's current-policy request and retry working", async () => {
    f = await screeningFixture(w, reviewer, false);
    const context = activate();
    const input = { requestKey: randomUUID() };
    expect(
      await requestScreening(context, f.tutor.headers, f.profile.id, input),
    ).toEqual({ revision: 0, replayed: false });
    expect(
      await requestScreening(context, f.tutor.headers, f.profile.id, input),
    ).toEqual({ revision: 0, replayed: true });
    expect(
      await readScreening(context, f.tutor.headers, f.profile.id, "owner"),
    ).toMatchObject({ revision: 0, state: "pending" });
  });
});
