import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  parsePrivateWorkflow,
  type PrivateWorkflowBinding,
  type PrivateWorkflowPacket,
} from "@/features/private-workflow/config";
import { localDatabaseConfig } from "@/lib/db/local-config";
import {
  changeAccess,
  listTargets,
  readTarget,
} from "@/features/account-restrictions/service";
import { handleAccountRestrictions } from "@/features/account-restrictions/handler";
import {
  authorizeRestrictionTarget,
  provisionRestrictionTarget,
} from "@/features/account-restrictions/fixture-tooling";
import {
  createPolicyReservation,
  readWorkflowCandidates,
} from "@/features/booking-workflows/service";
import { workflowFixture } from "../support/booking-workflows-fixtures";
import {
  closeWorld,
  createAccount,
  jsonRequest,
  openWorld,
  type TestAccount,
  type World,
} from "./support";

let world: World,
  staff: TestAccount,
  fixture: Awaited<ReturnType<typeof workflowFixture>>,
  student: TestAccount,
  ungranted: TestAccount,
  outsider: TestAccount,
  otherAdmin: TestAccount,
  wrongSource: TestAccount,
  directory: string,
  file: string,
  binding: PrivateWorkflowBinding,
  packet: PrivateWorkflowPacket;
type Heads = {
  admission: { current_policy_id: string; enabled: boolean } | null;
  booking: { policy_id: string; enabled: boolean } | null;
  screening: { version: string; status: string } | null;
};
let previousHeads: Heads;
function selectPacket(value = packet) {
  const next = `${file}.next`;
  writeFileSync(next, JSON.stringify(parsePrivateWorkflow(value, binding)), {
    mode: 0o600,
    flag: "wx",
  });
  renameSync(next, file);
  vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", file);
}
const body = (
  revision: number,
  status: "active" | "suspended" = "suspended",
) => ({
  revision,
  status,
  reason: status === "active" ? "local_restore_test" : "local_access_test",
  requestKey: randomUUID(),
});
async function state(target: TestAccount) {
  return (
    await world.owner.pool.query(
      `SELECT a.status,t.revision,
    (SELECT count(*)::int FROM account_restriction_events e WHERE e.target_user_id=t.user_id) events
    FROM account_restriction_targets t JOIN user_access a ON a.user_id=t.user_id WHERE t.user_id=$1`,
      [target.id],
    )
  ).rows[0];
}
async function retained(target: TestAccount) {
  return {
    roles: (
      await world.owner.pool.query(
        "SELECT role FROM user_roles WHERE user_id=$1 ORDER BY role",
        [target.id],
      )
    ).rows,
    sessions: (
      await world.owner.pool.query(
        "SELECT id,user_id,expires_at FROM session WHERE user_id=$1 ORDER BY id",
        [target.id],
      )
    ).rows,
    bookings: (
      await world.owner.pool.query(
        "SELECT id,state,workflow_revision,start_at_utc,end_at_utc FROM bookings WHERE tutor_id=$1 ORDER BY id",
        [fixture.profile.id],
      )
    ).rows,
  };
}
async function observedWait(blockerPid: number) {
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    const waiting = await world.owner.pool.query(
      `SELECT EXISTS(SELECT 1 FROM pg_stat_activity a
      WHERE a.datname=current_database() AND a.usename='learli_app' AND a.wait_event_type='Lock'
      AND $1=ANY(pg_blocking_pids(a.pid)) AND a.query LIKE '%change_local_account_access%') waiting`,
      [blockerPid],
    );
    if (waiting.rows[0]?.waiting) return;
  }
  throw new Error("Expected exact controlled account mutation lock wait.");
}
async function waitThenChangeScope(mode: "packet" | "legacy" | "targetEmail") {
  if (mode === "legacy") vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
  const before = await state(fixture.tutor),
    blocker = await world.owner.pool.connect();
  let pending: Promise<{ ok: boolean; status: number }> | undefined;
  try {
    await blocker.query("BEGIN");
    const pid = (await blocker.query("SELECT pg_backend_pid() pid")).rows[0]
      .pid as number;
    await blocker.query(
      "SELECT user_id FROM account_restriction_targets WHERE user_id=$1 FOR UPDATE",
      [fixture.tutor.id],
    );
    pending = changeAccess(
      world.runtime,
      staff.headers,
      fixture.tutor.id,
      body(before.revision),
    ).then(
      () => ({ ok: true, status: 200 }),
      (error: unknown) => ({
        ok: false,
        status:
          error &&
          typeof error === "object" &&
          "status" in error &&
          typeof error.status === "number"
            ? error.status
            : 503,
      }),
    );
    await observedWait(pid);
    if (mode === "targetEmail")
      await world.owner.pool.query('UPDATE "user" SET email=$2 WHERE id=$1', [
        fixture.tutor.id,
        `removed-${randomUUID()}@learli.test`,
      ]);
    else
      selectPacket(
        mode === "legacy"
          ? packet
          : {
              ...packet,
              accountEmails: packet.accountEmails.filter(
                (email) => email !== fixture.tutor.email,
              ),
            },
      );
    await blocker.query("COMMIT");
    expect(await pending).toEqual({
      ok: false,
      status: mode === "targetEmail" ? 404 : 503,
    });
    expect(await state(fixture.tutor)).toEqual(before);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
    await pending;
    if (mode === "targetEmail")
      await world.owner.pool.query('UPDATE "user" SET email=$2 WHERE id=$1', [
        fixture.tutor.id,
        fixture.tutor.email,
      ]);
    selectPacket();
  }
}

beforeAll(async () => {
  vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
  world = openWorld();
  previousHeads = (
    await world.owner.pool.query<Heads>(`SELECT
    (SELECT jsonb_build_object('current_policy_id',current_policy_id,'enabled',enabled) FROM learner_admission_policy_state WHERE source='synthetic_readiness' AND market_code='synthetic_test') admission,
    (SELECT jsonb_build_object('policy_id',policy_id,'enabled',enabled) FROM booking_workflow_policy_head WHERE source='synthetic_readiness') booking,
    (SELECT jsonb_build_object('version',version,'status',status) FROM tutor_screening_policy_heads WHERE provenance='synthetic_readiness') screening`)
  ).rows[0];
  staff = await createAccount(world, ["admin"], "Fictional account reviewer");
  fixture = await workflowFixture(world, staff, "guardian", "tutor");
  student = await createAccount(world, ["student"], "C Fictional Student");
  ungranted = await createAccount(
    world,
    ["parent"],
    "D Ungranted fictional account",
  );
  outsider = await createAccount(
    world,
    ["parent"],
    "E Outside fictional audience",
  );
  otherAdmin = await createAccount(
    world,
    ["admin"],
    "Other fictional reviewer",
  );
  wrongSource = await createAccount(
    world,
    ["parent"],
    "F Wrong-source fictional account",
  );
  await world.owner.pool.query('UPDATE "user" SET name=$2 WHERE id=$1', [
    fixture.requester.id,
    "A_% Fictional Parent",
  ]);
  await world.owner.pool.query('UPDATE "user" SET name=$2 WHERE id=$1', [
    fixture.tutor.id,
    "B Fictional Tutor",
  ]);
  for (const target of [fixture.requester, fixture.tutor, student, outsider]) {
    await provisionRestrictionTarget(world.owner, target.id);
    await authorizeRestrictionTarget(world.owner, staff.id, target.id);
  }
  // Explicit negative metadata fixture; it must not enter the local account tool.
  await world.owner.pool.query(
    "INSERT INTO account_restriction_targets(user_id,source) VALUES($1,'synthetic_readiness')",
    [wrongSource.id],
  );
  await world.owner.pool.query(
    "INSERT INTO account_restriction_grants(staff_user_id,target_user_id,source,status,valid_until,permitted_actions) VALUES($1,$2,'synthetic_readiness','authorized',clock_timestamp()+interval '1 hour',ARRAY['restrict','restore'])",
    [staff.id, wrongSource.id],
  );
  const slots = await readWorkflowCandidates(
    fixture.context,
    fixture.requester.headers,
    fixture.choice,
  );
  await createPolicyReservation(fixture.context, fixture.requester.headers, {
    ...fixture.choice,
    startAtUtc: slots[5].startAtUtc,
    endAtUtc: slots[5].endAtUtc,
    idempotencyKey: randomUUID(),
  });
  const config = localDatabaseConfig(process.env.DATABASE_URL, true);
  const host = config.host;
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1")
    throw new Error("Expected owned loopback test target.");
  binding = {
    origin: world.runtime.origin,
    database: {
      mode: "local-test",
      host,
      port: config.port,
      database: "learli_test",
      runtimeRole: "learli_app",
    },
  };
  packet = parsePrivateWorkflow(
    {
      version: 1,
      purpose: "private_fictional_workflow",
      audience: "fictional_only",
      realIntake: "disabled",
      payments: "disabled",
      origin: binding.origin,
      database: binding.database,
      accountEmails: [
        staff,
        fixture.requester,
        fixture.tutor,
        student,
        ungranted,
        otherAdmin,
        wrongSource,
      ].map((actor) => actor.email),
      admission: fixture.admission,
      screening: fixture.policy,
      booking: fixture.booking,
    },
    binding,
  );
  mkdirSync(path.join(process.cwd(), ".local"), {
    recursive: true,
    mode: 0o700,
  });
  directory = mkdtempSync(
    path.join(process.cwd(), ".local/private-admin-accounts-"),
  );
  file = path.join(directory, "packet.json");
  selectPacket();
}, 60_000);
beforeEach(() => selectPacket());
afterAll(async () => {
  vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
  try {
    if (world && fixture && previousHeads) {
      await world.owner.pool.query(
        "UPDATE booking_workflow_policy_head SET policy_id=$1,enabled=$2 WHERE source='synthetic_readiness' AND policy_id=$3",
        [
          previousHeads.booking?.policy_id ?? fixture.booking.policyId,
          previousHeads.booking?.enabled ?? false,
          fixture.booking.policyId,
        ],
      );
      await world.owner.pool.query(
        "UPDATE tutor_screening_policy_heads SET version=$1,status=$2 WHERE provenance='synthetic_readiness' AND version=$3",
        [
          previousHeads.screening?.version ?? fixture.policy.version,
          previousHeads.screening?.status ?? "revoked",
          fixture.policy.version,
        ],
      );
      await world.owner.pool.query(
        "UPDATE learner_admission_policy_state SET current_policy_id=$1,enabled=$2,revision=revision+1,updated_at=clock_timestamp() WHERE source='synthetic_readiness' AND market_code='synthetic_test' AND current_policy_id=$3",
        [
          previousHeads.admission?.current_policy_id ??
            fixture.admission.policyId,
          previousHeads.admission?.enabled ?? false,
          fixture.admission.policyId,
        ],
      );
    }
  } finally {
    await closeWorld(world);
    if (directory) rmSync(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
  }
});

describe("private fictional current-packet account management", () => {
  it("filters literal names/trusted roles/status and traverses populated bounded pages without unauthorized targets", async () => {
    const first = await listTargets(world.runtime, staff.headers, {
      pageSize: 2,
    });
    expect(first.targets.map((row) => row.id)).toEqual([
      fixture.requester.id,
      fixture.tutor.id,
    ]);
    expect(first.hasMore).toBe(true);
    const second = await listTargets(world.runtime, staff.headers, {
      page: 2,
      pageSize: 2,
    });
    expect(second.targets.map((row) => row.id)).toEqual([student.id]);
    expect(second.hasMore).toBe(false);
    expect(
      (await listTargets(world.runtime, staff.headers, { q: "%" })).targets.map(
        (row) => row.id,
      ),
    ).toEqual([fixture.requester.id]);
    expect(
      (await listTargets(world.runtime, staff.headers, { q: "_" })).targets.map(
        (row) => row.id,
      ),
    ).toEqual([fixture.requester.id]);
    expect(
      (
        await listTargets(world.runtime, staff.headers, {
          q: "fictional",
          role: "student",
          status: "active",
        })
      ).targets.map((row) => row.id),
    ).toEqual([student.id]);
    expect(
      (await listTargets(world.runtime, staff.headers, { status: "suspended" }))
        .targets,
    ).toEqual([]);
    const detail = await readTarget(
      world.runtime,
      staff.headers,
      fixture.tutor.id,
      { q: "Tutor", page: 2, pageSize: 2, historyPage: 1 },
    );
    expect(detail.roles).toEqual(["tutor"]);
    expect(detail.query).toMatchObject({ page: 2, pageSize: 2 });
    for (const forbidden of ["email", "session", "token"])
      expect(Object.keys(detail)).not.toContain(forbidden);
  });
  it("requires exact finite target/staff authority and rejects malformed filters with zero events", async () => {
    const before = await state(outsider);
    for (const target of [
      ungranted,
      outsider,
      staff,
      otherAdmin,
      wrongSource,
    ]) {
      await expect(
        readTarget(world.runtime, staff.headers, target.id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        changeAccess(world.runtime, staff.headers, target.id, body(0)),
      ).rejects.toMatchObject({ status: 404 });
    }
    expect(
      (await listTargets(world.runtime, otherAdmin.headers)).targets,
    ).toEqual([]);
    selectPacket({
      ...packet,
      accountEmails: packet.accountEmails.filter(
        (email) => email !== staff.email,
      ),
    });
    await expect(
      listTargets(world.runtime, staff.headers),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      changeAccess(world.runtime, staff.headers, fixture.tutor.id, body(0)),
    ).rejects.toMatchObject({ status: 403 });
    selectPacket();
    for (const query of [
      "q=one&q=two",
      "role=admin",
      "pageSize=21",
      "status=deleted",
      "actorUserId=foreign",
    ]) {
      const response = await handleAccountRestrictions(
        world.runtime,
        jsonRequest(world, `/api/admin/accounts?${query}`, {
          method: "GET",
          cookie: staff.cookie,
        }),
      );
      expect(response.status).toBe(400);
    }
    expect(await state(outsider)).toEqual(before);
  });
  it("suspends/restores once under concurrent replay while retaining trusted roles, provider sessions and saved bookings", async () => {
    const before = await state(fixture.tutor),
      preserved = await retained(fixture.tutor),
      input = body(before.revision);
    const results = await Promise.all([
      changeAccess(world.runtime, staff.headers, fixture.tutor.id, input),
      changeAccess(world.runtime, staff.headers, fixture.tutor.id, input),
    ]);
    expect(results.map((row) => row.replayed).sort()).toEqual([false, true]);
    expect(await state(fixture.tutor)).toMatchObject({
      status: "suspended",
      revision: before.revision + 1,
      events: before.events + 1,
    });
    expect(
      (
        await listTargets(world.runtime, staff.headers, {
          role: "tutor",
          status: "suspended",
        })
      ).targets.map((row) => row.id),
    ).toEqual([fixture.tutor.id]);
    await changeAccess(
      world.runtime,
      staff.headers,
      fixture.tutor.id,
      body(before.revision + 1, "active"),
    );
    expect(await retained(fixture.tutor)).toEqual(preserved);
    expect(
      (
        await readTarget(world.runtime, staff.headers, fixture.tutor.id)
      ).history.map((row) => row.nextStatus),
    ).toEqual(["active", "suspended"]);
    await expect(
      changeAccess(
        world.runtime,
        staff.headers,
        fixture.tutor.id,
        body(before.revision),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(await state(fixture.tutor)).toMatchObject({
      revision: before.revision + 2,
      events: before.events + 2,
    });
  });
  it("rolls back status and audit when a valid packet removes the target during the observed function lock wait", async () => {
    await waitThenChangeScope("packet");
  });
  it("fresh post-function SQL rolls back when the target email leaves the captured audience during a lock wait", async () => {
    await waitThenChangeScope("targetEmail");
  });
  it("retains legacy scope without a packet but rolls back a waiting legacy action if private mode becomes active", async () => {
    vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
    expect(
      (await listTargets(world.runtime, staff.headers)).targets.map(
        (row) => row.id,
      ),
    ).toContain(outsider.id);
    expect(
      (await readTarget(world.runtime, staff.headers, fixture.tutor.id)).roles,
    ).toBeUndefined();
    await waitThenChangeScope("legacy");
    writeFileSync(file, JSON.stringify({ invalid: true }), { mode: 0o600 });
    const result = await handleAccountRestrictions(
      world.runtime,
      jsonRequest(world, "/api/admin/accounts", {
        method: "GET",
        cookie: staff.cookie,
      }),
    );
    expect(result.status).toBe(503);
  });
});
