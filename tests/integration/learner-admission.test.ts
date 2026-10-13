import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  createAdmission,
  readMyAdmission,
  readAssignedAdmission,
  mutateAdmissionReview,
  listAdmittedLearners,
  readAdmittedLearner,
  updateAdmittedLearner,
  readAdmissionIntake,
  type AdmissionContext,
} from "@/features/learner-admission/service";
import { handleAdmissionRequest } from "@/features/learner-admission/handler";
import { createMyLearner } from "@/features/learners/service";
import {
  provisionAdmissionPolicy,
  assignAdmissionReviewer,
} from "../support/learner-admission-fixtures";
import {
  openWorld,
  closeWorld,
  createAccount,
  jsonRequest,
  type World,
  type TestAccount,
} from "./support";
let world: World,
  context: AdmissionContext,
  requester: TestAccount,
  other: TestAccount,
  reviewer: TestAccount,
  unassigned: TestAccount;
const base = {
  management: "guardian",
  displayName: "Fictional admission learner",
  level: "elementary",
  timezone: "Asia/Manila",
};
const values = (extra = {}) => ({
  ...base,
  requestId: randomUUID(),
  policyVersion:
    context.admission.authority === "synthetic_test"
      ? context.admission.version
      : "",
  policyDigest:
    context.admission.authority === "synthetic_test"
      ? context.admission.contentDigest
      : "",
  ...extra,
});
const create = (actor: TestAccount = requester, extra = {}) =>
  createAdmission(context, actor.headers, values(extra));
async function assigned(actor = requester, extra = {}) {
  const row = await create(actor, extra);
  await assignAdmissionReviewer(world.owner.pool, row.id, reviewer.id);
  return readAssignedAdmission(context, reviewer.headers, row.id);
}
async function evidence(id: string, checkCode: string, revision?: number) {
  const row = await readAssignedAdmission(context, reviewer.headers, id);
  return mutateAdmissionReview(context, reviewer.headers, id, "evidence", {
    requestId: randomUUID(),
    revision: revision ?? row.revision,
    checkCode,
    reference: `synthetic:${randomUUID()}`,
  });
}
async function decision(id: string, action = "authorize", extra = {}) {
  const row = await readAssignedAdmission(context, reviewer.headers, id);
  return mutateAdmissionReview(context, reviewer.headers, id, "decision", {
    requestId: randomUUID(),
    revision: row.revision,
    action,
    ...extra,
  });
}
async function complete(id: string, mode = "guardian") {
  if (mode === "guardian") {
    await evidence(id, "guardian_authority");
    await evidence(id, "guardian_notice");
  } else await evidence(id, "independent_eligibility");
  return decision(id);
}
async function authority(actor: TestAccount, id: string) {
  return listAdmittedLearners(context, actor.headers).then((rows) =>
    rows.some((r) => r.id === id),
  );
}
beforeAll(async () => {
  world = openWorld();
  context = {
    runtime: world.runtime,
    admission: await provisionAdmissionPolicy(world.owner.pool),
  };
  requester = await createAccount(world);
  other = await createAccount(world);
  reviewer = await createAccount(world, ["admin"]);
  unassigned = await createAccount(world, ["admin"]);
}, 30000);
afterAll(() => closeWorld(world));
describe("synthetic admission actual PostgreSQL and provider authority", () => {
  it("keeps pending intake private with no family role, link or active authority", async () => {
    const a = await create();
    expect(a.state).toBe("pending");
    expect(await authority(requester, a.learner.id)).toBe(false);
    expect(
      (
        await world.owner.pool.query(
          "SELECT role FROM user_roles WHERE user_id=$1",
          [requester.id],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await world.owner.pool.query(
          "SELECT * FROM guardian_learner_links WHERE learner_id=$1",
          [a.learner.id],
        )
      ).rows,
    ).toEqual([]);
    await expect(
      readMyAdmission(context, other.headers, a.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      readAdmittedLearner(context, requester.headers, a.learner.id),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("requires both matching guardian checks before atomically authorizing parent and link", async () => {
    const a = await assigned();
    await expect(decision(a.id)).rejects.toMatchObject({ status: 404 });
    await evidence(a.id, "guardian_authority");
    await expect(decision(a.id)).rejects.toMatchObject({ status: 404 });
    await evidence(a.id, "guardian_notice");
    const approved = await decision(a.id);
    expect(approved.state).toBe("authorized");
    expect(await authority(requester, a.learner.id)).toBe(true);
    expect(await authority(other, a.learner.id)).toBe(false);
    expect(
      (
        await world.owner.pool.query(
          "SELECT role FROM user_roles WHERE user_id=$1",
          [requester.id],
        )
      ).rows,
    ).toEqual([{ role: "parent" }]);
    expect(
      (
        await world.owner.pool.query(
          "SELECT source,status FROM guardian_learner_links WHERE learner_id=$1",
          [a.learner.id],
        )
      ).rows,
    ).toEqual([{ source: "synthetic_readiness", status: "authorized" }]);
  });
  it("supports independent College with separate evidence and no guardian/parent requirement", async () => {
    const adult = await createAccount(world);
    const a = await assigned(adult, {
      management: "self",
      level: "college_support",
    });
    await expect(decision(a.id)).rejects.toMatchObject({ status: 404 });
    await expect(evidence(a.id, "guardian_authority")).rejects.toMatchObject({
      status: 400,
    });
    await complete(a.id, "self");
    expect(await authority(adult, a.learner.id)).toBe(true);
    expect(
      (
        await world.owner.pool.query(
          "SELECT role FROM user_roles WHERE user_id=$1",
          [adult.id],
        )
      ).rows,
    ).toEqual([{ role: "student" }]);
    expect(
      (
        await world.owner.pool.query(
          "SELECT * FROM guardian_learner_links WHERE learner_id=$1",
          [a.learner.id],
        )
      ).rows,
    ).toEqual([]);
    await expect(
      create(adult, { management: "self", level: "college_support" }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("revokes authority without deleting the ordinary role/history and never reactivates on replay", async () => {
    const a = await assigned();
    await evidence(a.id, "guardian_authority");
    await evidence(a.id, "guardian_notice");
    const current = await readAssignedAdmission(
      context,
      reviewer.headers,
      a.id,
    );
    const input = {
      requestId: randomUUID(),
      revision: current.revision,
      action: "authorize",
    };
    await mutateAdmissionReview(
      context,
      reviewer.headers,
      a.id,
      "decision",
      input,
    );
    await decision(a.id, "revoke");
    expect(await authority(requester, a.learner.id)).toBe(false);
    const replay = await mutateAdmissionReview(
      context,
      reviewer.headers,
      a.id,
      "decision",
      input,
    );
    expect(replay.state).toBe("revoked");
    expect(
      (
        await world.owner.pool.query(
          "SELECT status FROM guardian_learner_links WHERE learner_id=$1",
          [a.learner.id],
        )
      ).rows,
    ).toEqual([{ status: "revoked" }]);
    await expect(decision(a.id)).rejects.toMatchObject({ status: 409 });
  });
  it("evidence revocation atomically removes granted current relationship and records both events", async () => {
    const a = await assigned();
    await complete(a.id);
    const current = await readAssignedAdmission(
      context,
      reviewer.headers,
      a.id,
    );
    const e = current.evidence[0];
    const revoked = await mutateAdmissionReview(
      context,
      reviewer.headers,
      a.id,
      "revoke-evidence",
      { requestId: randomUUID(), revision: current.revision, evidenceId: e.id },
    );
    expect(revoked.state).toBe("revoked");
    expect(revoked.revision).toBe(current.revision + 2);
    expect(await authority(requester, a.learner.id)).toBe(false);
    const events = (
      await world.owner.pool.query(
        "SELECT event FROM learner_admission_events WHERE admission_id=$1 ORDER BY revision DESC LIMIT 2",
        [a.id],
      )
    ).rows;
    expect(events).toEqual([
      { event: "revoked" },
      { event: "evidence_revoked" },
    ]);
  });
  it("global unassigned admin and foreign requester cannot read evidence or decide", async () => {
    const a = await assigned();
    await expect(
      readAssignedAdmission(context, unassigned.headers, a.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      mutateAdmissionReview(context, unassigned.headers, a.id, "decision", {
        role: "admin",
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      readMyAdmission(context, other.headers, a.id),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("rejects self-review assignment even for an assured administrator", async () => {
    const self = await create(reviewer);
    await expect(
      assignAdmissionReviewer(world.owner.pool, self.id, reviewer.id),
    ).rejects.toMatchObject({ code: "55000" });
    expect(
      (
        await world.owner.pool.query(
          "SELECT * FROM learner_admission_assignments WHERE admission_id=$1",
          [self.id],
        )
      ).rows,
    ).toEqual([]);
  });
  it("no policy denies intake before deserializing or storing child payload", async () => {
    const disabled = {
      runtime: world.runtime,
      admission: { authority: "disabled" as const },
    };
    expect(await readAdmissionIntake(disabled, requester.headers)).toEqual({
      enabled: false,
    });
    const request = jsonRequest(world, "/api/learner-admission", {
      cookie: requester.cookie,
      body: { displayName: "not collected" },
    });
    let parsed = false;
    request.text = async () => {
      parsed = true;
      throw new Error("Must not read disabled payload");
    };
    expect(
      (
        await handleAdmissionRequest(
          world.runtime,
          request,
          undefined,
          undefined,
          disabled,
        )
      ).status,
    ).toBe(503);
    expect(parsed).toBe(false);
  });
  it("strict intake refuses role/source/child IDs and noncollege independent mode", async () => {
    for (const extra of [
      { role: "admin" },
      { learnerId: randomUUID() },
      { source: "operational" },
      { guardianUserId: other.id },
      { management: "self", level: "elementary" },
    ])
      await expect(create(requester, extra)).rejects.toHaveProperty("issues");
  });
  it("concurrent same-key intake creates one learner and one requested receipt", async () => {
    const input = values();
    const result = await Promise.all([
      createAdmission(context, requester.headers, input),
      createAdmission(context, requester.headers, input),
    ]);
    expect(result[0].id).toBe(result[1].id);
    expect(
      (
        await world.owner.pool.query(
          "SELECT count(*)::int n FROM learner_admission_events WHERE admission_id=$1 AND event='requested'",
          [result[0].id],
        )
      ).rows[0].n,
    ).toBe(1);
    await expect(
      createAdmission(context, requester.headers, {
        ...input,
        displayName: "Different fictional label",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("concurrent authorize versus reject has one effect and a stale losing request", async () => {
    const a = await assigned();
    await evidence(a.id, "guardian_authority");
    const ready = await evidence(a.id, "guardian_notice");
    const results = await Promise.allSettled(
      ["authorize", "reject"].map((action) =>
        mutateAdmissionReview(context, reviewer.headers, a.id, "decision", {
          requestId: randomUUID(),
          revision: ready.revision,
          action,
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const current = await readMyAdmission(context, requester.headers, a.id);
    expect(["authorized", "rejected"]).toContain(current.state);
    expect(await authority(requester, a.learner.id)).toBe(
      current.state === "authorized",
    );
  });
  it("denies approval after policy disable but permits rejection and revocation", async () => {
    const a = await assigned();
    await evidence(a.id, "guardian_authority");
    await evidence(a.id, "guardian_notice");
    const b = await assigned();
    await complete(b.id);
    await world.owner.pool.query(
      "UPDATE learner_admission_policy_state SET enabled=false,revision=revision+1",
    );
    try {
      expect(
        (await readAdmissionIntake(context, requester.headers)).enabled,
      ).toBe(false);
      await expect(create()).rejects.toMatchObject({ status: 503 });
      await expect(decision(a.id)).rejects.toMatchObject({ status: 503 });
      expect((await decision(a.id, "reject")).state).toBe("rejected");
      expect(await authority(requester, b.learner.id)).toBe(false);
      expect((await decision(b.id, "revoke")).state).toBe("revoked");
    } finally {
      await world.owner.pool.query(
        "UPDATE learner_admission_policy_state SET enabled=true,revision=revision+1",
      );
    }
  });
  it("allows admitted name/zone edits but rejects raw runtime writes and reviewed-level changes", async () => {
    const a = await assigned();
    await complete(a.id);
    await expect(
      world.runtime.pool.query(
        "UPDATE learner_profiles SET display_name=$1 WHERE id=$2",
        ["Raw fictional edit", a.learner.id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    const updated = await updateAdmittedLearner(
      context,
      requester.headers,
      a.learner.id,
      { displayName: "Revised fictional display", timezone: "UTC" },
    );
    expect(updated.displayName).toBe("Revised fictional display");
    await expect(
      updateAdmittedLearner(context, requester.headers, a.learner.id, {
        displayName: "Fictional",
        timezone: "UTC",
        level: "high_school",
      }),
    ).rejects.toHaveProperty("issues");
  });
  it("preserves existing immediate local demo creation with its original source", async () => {
    const demo = await createAccount(world, ["parent"]);
    const row = await createMyLearner(world.runtime, demo.headers, {
      ...base,
      requestId: randomUUID(),
    });
    expect(
      (
        await world.owner.pool.query(
          "SELECT source,status FROM learner_profiles WHERE id=$1",
          [row.id],
        )
      ).rows,
    ).toEqual([{ source: "local_fixture", status: "active" }]);
    expect(
      (
        await world.owner.pool.query(
          "SELECT * FROM learner_admissions WHERE learner_id=$1",
          [row.id],
        )
      ).rows,
    ).toEqual([]);
  });
});

async function lockWait(
  query: string,
  params: unknown[],
  run: () => Promise<unknown>,
  change: (client: PoolClient) => Promise<unknown>,
) {
  const locker = await world.owner.pool.connect();
  let pending: Promise<unknown> | undefined;
  try {
    await locker.query("BEGIN");
    await locker.query(query, params);
    pending = run();
    const guarded = pending.then(
      (result) => ({ result, error: undefined }),
      (error) => ({ result: undefined, error }),
    );
    let observed = false;
    for (let i = 0; i < 300; i++) {
      const locks = await world.owner.pool.query(
        "SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND usename='learli_app' AND wait_event_type='Lock' AND query LIKE '%decide_learner_admission%' AND pid<>pg_backend_pid()",
      );
      if (locks.rows[0].n > 0) {
        observed = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(observed).toBe(true);
    await change(locker);
    await locker.query("COMMIT");
    const result = await guarded;
    expect(result.error).toBeUndefined();
    expect(result.result).toMatchObject({ rows: [{ outcome: "forbidden" }] });
  } finally {
    await locker.query("ROLLBACK");
    locker.release();
    await pending?.catch(() => {});
  }
}
describe("admission fresh after actual observed serialization waits", () => {
  const cases = [
    "actor",
    "session",
    "policy",
    "admission",
    "learner",
    "assignment",
    "capability",
    "evidence",
  ] as const;
  it.each(cases)(
    "rejects current reviewer revocation after %s lock wait",
    async (kind) => {
      const family = await createAccount(world);
      const staff = await createAccount(world, ["admin"]);
      const a = await create(family);
      await assignAdmissionReviewer(world.owner.pool, a.id, staff.id);
      let state = await readAssignedAdmission(context, staff.headers, a.id);
      for (const checkCode of ["guardian_authority", "guardian_notice"])
        state = await mutateAdmissionReview(
          context,
          staff.headers,
          a.id,
          "evidence",
          {
            requestId: randomUUID(),
            revision: state.revision,
            checkCode,
            reference: `wait:${randomUUID()}`,
          },
        );
      const session = (await world.runtime.auth.api.getSession({
        headers: staff.headers,
      }))!;
      const id = session.session.id;
      const lock: { query: string; params: unknown[] } = {
        actor: {
          query: 'SELECT id FROM "user" WHERE id=$1 FOR NO KEY UPDATE',
          params: [staff.id],
        },
        session: {
          query: "SELECT id FROM session WHERE id=$1 FOR UPDATE",
          params: [id],
        },
        policy: {
          query: "SELECT source FROM learner_admission_policy_state FOR UPDATE",
          params: [],
        },
        admission: {
          query:
            "SELECT id FROM learner_admissions WHERE id=$1 FOR NO KEY UPDATE",
          params: [a.id],
        },
        learner: {
          query:
            "SELECT id FROM learner_profiles WHERE id=$1 FOR NO KEY UPDATE",
          params: [a.learner.id],
        },
        assignment: {
          query:
            "SELECT admission_id FROM learner_admission_assignments WHERE admission_id=$1 FOR UPDATE",
          params: [a.id],
        },
        capability: {
          query:
            "SELECT user_id FROM learner_admission_reviewers WHERE user_id=$1 FOR UPDATE",
          params: [staff.id],
        },
        evidence: {
          query:
            "SELECT id FROM learner_admission_evidence WHERE admission_id=$1 FOR UPDATE",
          params: [a.id],
        },
      }[kind];
      await lockWait(
        lock.query,
        lock.params,
        () =>
          world.runtime.pool.query(
            "SELECT * FROM public.decide_learner_admission($1,$2,$3,$4,$5,$6)",
            [staff.id, id, a.id, state.revision, randomUUID(), "authorize"],
          ),
        (c) =>
          c.query("DELETE FROM user_roles WHERE user_id=$1 AND role='admin'", [
            staff.id,
          ]),
      );
      const row = await readMyAdmission(context, family.headers, a.id);
      expect(row.state).toBe("pending");
      expect(await authority(family, a.learner.id)).toBe(false);
      expect(
        (
          await world.owner.pool.query(
            "SELECT * FROM guardian_learner_links WHERE learner_id=$1",
            [a.learner.id],
          )
        ).rows,
      ).toEqual([]);
    },
    15000,
  );
  it.each([
    "role",
    "expired_session",
    "suspended",
    "unverified",
    "factor",
    "epoch",
    "receipt",
    "requester_access",
    "assignment",
  ])(
    "denies %s lost during actual admission wait",
    async (kind) => {
      const family = await createAccount(world);
      const staff = await createAccount(world, ["admin"]);
      const a = await create(family);
      await assignAdmissionReviewer(world.owner.pool, a.id, staff.id);
      let row = await readAssignedAdmission(context, staff.headers, a.id);
      for (const checkCode of ["guardian_authority", "guardian_notice"])
        row = await mutateAdmissionReview(
          context,
          staff.headers,
          a.id,
          "evidence",
          {
            requestId: randomUUID(),
            revision: row.revision,
            checkCode,
            reference: `fresh:${randomUUID()}`,
          },
        );
      const session = (await world.runtime.auth.api.getSession({
        headers: staff.headers,
      }))!;
      const sid = session.session.id;
      // Actor-row wait permits account field mutation without reversing held locks.
      const changes: Record<string, [string, unknown[]]> = {
        role: [
          "DELETE FROM user_roles WHERE user_id=$1 AND role='admin'",
          [staff.id],
        ],
        expired_session: [
          "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
          [sid],
        ],
        suspended: [
          "UPDATE user_access SET status='suspended' WHERE user_id=$1",
          [staff.id],
        ],
        unverified: [
          'UPDATE "user" SET email_verified=false WHERE id=$1',
          [staff.id],
        ],
        factor: [
          'UPDATE "user" SET two_factor_enabled=false WHERE id=$1',
          [staff.id],
        ],
        epoch: [
          "UPDATE admin_security_epochs SET epoch=epoch+1 WHERE user_id=$1",
          [staff.id],
        ],
        receipt: [
          "DELETE FROM admin_assurance_receipts WHERE session_id=$1",
          [sid],
        ],
        requester_access: [
          "UPDATE user_access SET status='suspended' WHERE user_id=$1",
          [family.id],
        ],
        assignment: [
          "UPDATE learner_admission_assignments SET reviewer_user_id=$1 WHERE admission_id=$2",
          [unassigned.id, a.id],
        ],
      };
      if (kind === "assignment")
        await world.owner.pool.query(
          "INSERT INTO learner_admission_reviewers(user_id,source,capability_code,active) VALUES($1,'synthetic_readiness','learner_admission_review',true) ON CONFLICT DO NOTHING",
          [unassigned.id],
        );
      await lockWait(
        'SELECT id FROM "user" WHERE id=$1 FOR NO KEY UPDATE',
        [staff.id],
        () =>
          world.runtime.pool.query(
            "SELECT * FROM public.decide_learner_admission($1,$2,$3,$4,$5,$6)",
            [staff.id, sid, a.id, row.revision, randomUUID(), "authorize"],
          ),
        (c) => c.query(changes[kind][0], changes[kind][1]),
      );
      expect(
        (await readMyAdmission(context, family.headers, a.id).catch(() => null))
          ?.state ?? "pending",
      ).toBe("pending");
      expect(
        (
          await world.owner.pool.query(
            "SELECT status FROM learner_profiles WHERE id=$1",
            [a.learner.id],
          )
        ).rows[0].status,
      ).toBe("inactive");
    },
    15000,
  );
  it("concurrent same-key evidence and decisions produce one immutable effect each", async () => {
    const family = await createAccount(world);
    const a = await assigned(family);
    const command = {
      requestId: randomUUID(),
      revision: a.revision,
      checkCode: "guardian_authority",
      reference: `once:${randomUUID()}`,
    };
    const results = await Promise.all([
      mutateAdmissionReview(
        context,
        reviewer.headers,
        a.id,
        "evidence",
        command,
      ),
      mutateAdmissionReview(
        context,
        reviewer.headers,
        a.id,
        "evidence",
        command,
      ),
    ]);
    expect(results[0].revision).toBe(results[1].revision);
    expect(results[0].evidence).toHaveLength(1);
    const ready = await evidence(a.id, "guardian_notice");
    const decide = {
      requestId: randomUUID(),
      revision: ready.revision,
      action: "authorize",
    };
    await Promise.all([
      mutateAdmissionReview(
        context,
        reviewer.headers,
        a.id,
        "decision",
        decide,
      ),
      mutateAdmissionReview(
        context,
        reviewer.headers,
        a.id,
        "decision",
        decide,
      ),
    ]);
    expect(
      (
        await world.owner.pool.query(
          "SELECT count(*)::int n FROM learner_admission_events WHERE admission_id=$1 AND event='authorized'",
          [a.id],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("rolled-back role failure leaves no active learner, guardian link or authorized receipt", async () => {
    const family = await createAccount(world);
    const a = await assigned(family);
    await evidence(a.id, "guardian_authority");
    await evidence(a.id, "guardian_notice");
    // Unique owned temporary constraint, targeting this fictional actor only.
    const failDdl = (
      await world.owner.pool.query(
        "SELECT format('ALTER TABLE user_roles ADD CONSTRAINT w5_role_failure CHECK (user_id <> %L OR role <> ''parent'') NOT VALID', $1::text) ddl",
        [family.id],
      )
    ).rows[0].ddl as string;
    await world.owner.pool.query(failDdl);
    try {
      await expect(decision(a.id)).rejects.toThrow();
      expect((await readMyAdmission(context, family.headers, a.id)).state).toBe(
        "pending",
      );
      expect(
        (
          await world.owner.pool.query(
            "SELECT * FROM guardian_learner_links WHERE learner_id=$1",
            [a.learner.id],
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await world.owner.pool.query(
            "SELECT * FROM learner_admission_events WHERE admission_id=$1 AND event='authorized'",
            [a.id],
          )
        ).rows,
      ).toEqual([]);
    } finally {
      await world.owner.pool.query(
        "ALTER TABLE user_roles DROP CONSTRAINT w5_role_failure",
      );
    }
  });
  it("raw function refuses private continuation fields and cross-source link constraints", async () => {
    const family = await createAccount(world);
    const session = (await world.runtime.auth.api.getSession({
      headers: family.headers,
    }))!;
    const result = await world.runtime.pool.query(
      "SELECT * FROM public.create_learner_admission($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        family.id,
        session.session.id,
        randomUUID(),
        context.admission.authority === "synthetic_test"
          ? context.admission.policyId
          : null,
        "guardian",
        "Fictional",
        "elementary",
        "UTC",
        "/bookings/demo?learnerId=private",
      ],
    );
    expect(result.rows[0].outcome).toBe("invalid");
    const a = await assigned(family);
    await complete(a.id);
    await expect(
      world.owner.pool.query(
        "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
        [other.id, a.learner.id],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });
});

describe("independent review post-write and immutable receipt regressions", () => {
  it("aborts every decision effect after observed derived-role unique wait and reviewer revocation", async () => {
    const family = await createAccount(world);
    const staff = await createAccount(world, ["admin"]);
    const a = await create(family);
    await assignAdmissionReviewer(world.owner.pool, a.id, staff.id);
    let row = await readAssignedAdmission(context, staff.headers, a.id);
    for (const checkCode of ["guardian_authority", "guardian_notice"])
      row = await mutateAdmissionReview(
        context,
        staff.headers,
        a.id,
        "evidence",
        {
          requestId: randomUUID(),
          revision: row.revision,
          checkCode,
          reference: `unique:${randomUUID()}`,
        },
      );
    const sid = (await world.runtime.auth.api.getSession({
      headers: staff.headers,
    }))!.session.id;
    const locker = await world.owner.pool.connect();
    let attempt: Promise<{ error: unknown }> | undefined;
    try {
      await locker.query("BEGIN");
      await locker.query(
        "INSERT INTO user_roles(user_id,role) VALUES($1,'parent')",
        [family.id],
      );
      attempt = world.runtime.pool
        .query(
          "SELECT * FROM public.decide_learner_admission($1,$2,$3,$4,$5,$6)",
          [staff.id, sid, a.id, row.revision, randomUUID(), "authorize"],
        )
        .then(
          () => ({ error: undefined }),
          (error) => ({ error }),
        );
      let observed = false;
      for (let i = 0; i < 300; i++) {
        const result = await world.owner.pool.query(
          "SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND usename='learli_app' AND wait_event_type='Lock' AND query LIKE '%decide_learner_admission%'",
        );
        if (result.rows[0].n > 0) {
          observed = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(observed).toBe(true);
      await locker.query(
        "DELETE FROM user_roles WHERE user_id=$1 AND role='admin'",
        [staff.id],
      );
      await locker.query("COMMIT");
      expect((await attempt).error).toMatchObject({ code: "42501" });
      expect((await readMyAdmission(context, family.headers, a.id)).state).toBe(
        "pending",
      );
      expect(
        (
          await world.owner.pool.query(
            "SELECT status FROM learner_profiles WHERE id=$1",
            [a.learner.id],
          )
        ).rows[0].status,
      ).toBe("inactive");
      expect(
        (
          await world.owner.pool.query(
            "SELECT * FROM guardian_learner_links WHERE learner_id=$1",
            [a.learner.id],
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await world.owner.pool.query(
            "SELECT * FROM learner_admission_events WHERE admission_id=$1 AND event='authorized'",
            [a.id],
          )
        ).rows,
      ).toEqual([]);
    } finally {
      await locker.query("ROLLBACK");
      locker.release();
      await attempt;
    }
  });
  it("returns the same immutable evidence-revoke receipt revision on original and replay", async () => {
    const family = await createAccount(world);
    const a = await assigned(family);
    await complete(a.id);
    const row = await readAssignedAdmission(context, reviewer.headers, a.id);
    const sid = (await world.runtime.auth.api.getSession({
      headers: reviewer.headers,
    }))!.session.id;
    const params = [
      reviewer.id,
      sid,
      a.id,
      row.revision,
      randomUUID(),
      row.evidence[0].id,
    ];
    const original = await world.runtime.pool.query(
      "SELECT * FROM public.revoke_learner_admission_evidence($1,$2,$3,$4,$5,$6)",
      params,
    );
    const replay = await world.runtime.pool.query(
      "SELECT * FROM public.revoke_learner_admission_evidence($1,$2,$3,$4,$5,$6)",
      params,
    );
    expect(original.rows[0].revision).toBe(replay.rows[0].revision);
    expect(original.rows[0].revision).toBe(row.revision + 1);
    expect(
      (await readMyAdmission(context, family.headers, a.id)).revision,
    ).toBe(row.revision + 2);
    expect(await authority(family, a.learner.id)).toBe(false);
  });
});

describe("post-write global evidence uniqueness boundary", () => {
  it("aborts evidence and receipt after observed unique wait, owner rollback and admin revocation", async () => {
    const familyA = await createAccount(world),
      staffA = await createAccount(world, ["admin"]),
      familyB = await createAccount(world),
      staffB = await createAccount(world, ["admin"]);
    const a = await create(familyA),
      b = await create(familyB);
    await assignAdmissionReviewer(world.owner.pool, a.id, staffA.id);
    await assignAdmissionReviewer(world.owner.pool, b.id, staffB.id);
    const aRow = await readAssignedAdmission(context, staffA.headers, a.id),
      bRow = await readAssignedAdmission(context, staffB.headers, b.id);
    const sidA = (await world.runtime.auth.api.getSession({
        headers: staffA.headers,
      }))!.session.id,
      sidB = (await world.runtime.auth.api.getSession({
        headers: staffB.headers,
      }))!.session.id;
    const reference = `unique-reference:${randomUUID()}`;
    const locker = await world.owner.pool.connect();
    let attempt: Promise<{ error: unknown }> | undefined;
    try {
      await locker.query("BEGIN");
      const prepared = await locker.query(
        "SELECT * FROM public.record_learner_admission_evidence($1,$2,$3,$4,$5,$6,$7)",
        [
          staffB.id,
          sidB,
          b.id,
          bRow.revision,
          randomUUID(),
          "guardian_authority",
          reference,
        ],
      );
      expect(prepared.rows[0].outcome).toBe("recorded");
      attempt = world.runtime.pool
        .query(
          "SELECT * FROM public.record_learner_admission_evidence($1,$2,$3,$4,$5,$6,$7)",
          [
            staffA.id,
            sidA,
            a.id,
            aRow.revision,
            randomUUID(),
            "guardian_authority",
            reference,
          ],
        )
        .then(
          () => ({ error: undefined }),
          (error) => ({ error }),
        );
      let observed = false;
      for (let i = 0; i < 300; i++) {
        const result = await world.owner.pool.query(
          "SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND usename='learli_app' AND wait_event_type='Lock' AND query LIKE '%record_learner_admission_evidence%'",
        );
        if (result.rows[0].n > 0) {
          observed = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(observed).toBe(true);
      await world.owner.pool.query(
        "DELETE FROM user_roles WHERE user_id=$1 AND role='admin'",
        [staffA.id],
      );
      await locker.query("ROLLBACK");
      expect((await attempt).error).toMatchObject({ code: "42501" });
      expect(
        (
          await world.owner.pool.query(
            "SELECT * FROM learner_admission_evidence WHERE reference=$1",
            [reference],
          )
        ).rows,
      ).toEqual([]);
      expect(
        (await readMyAdmission(context, familyA.headers, a.id)).revision,
      ).toBe(aRow.revision);
      expect(
        (await readMyAdmission(context, familyB.headers, b.id)).revision,
      ).toBe(bRow.revision);
    } finally {
      await locker.query("ROLLBACK");
      locker.release();
      await attempt;
    }
  });
});
