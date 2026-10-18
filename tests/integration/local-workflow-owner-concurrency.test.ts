import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { composeAccountAuth } from "@/features/hosted-auth/composition";
import { captureLocalMail } from "@/lib/email/local-mail";
import { syntheticEmail } from "@/lib/local-mode";
import { runtimeGrantsSql } from "../../scripts/runtime-grants";
import {
  prepareLocalPolicies,
  prepareLocalStaff,
} from "../../scripts/local-workflow";
import { assertOwnedReadinessDatabase } from "../support/readiness-placement";
import {
  createAccount,
  openWorld,
  closeWorld,
  type World,
  type TestAccount,
} from "./support";

let control: World;
let world: World;
let actor: TestAccount;
let sessionId: string;
const database = `learli_owner_race_${randomUUID().replaceAll("-", "")}`;
let created = false;

beforeAll(async () => {
  assertOwnedReadinessDatabase(process.cwd());
  control = openWorld();
  await control.owner.pool.query(
    `CREATE DATABASE ${database} OWNER learli_owner`,
  );
  created = true;
  await control.owner.pool.query(
    `REVOKE ALL ON DATABASE ${database} FROM PUBLIC;GRANT CONNECT ON DATABASE ${database} TO learli_app`,
  );
  const options = (pool: Pool) => ({
    host: pool.options.host,
    port: pool.options.port,
    user: pool.options.user,
    password: pool.options.password,
    database,
    ssl: false as const,
    max: 5,
    connectionTimeoutMillis: 3000,
    statement_timeout: 10000,
  });
  const ownerPool = new Pool(options(control.owner.pool)),
    appPool = new Pool(options(control.runtime.pool));
  const db = drizzle(appPool, { schema });
  world = {
    owner: { pool: ownerPool, db: drizzle(ownerPool, { schema }) },
    runtime: {
      ...composeAccountAuth(db, {
        origin: control.runtime.origin,
        secret: process.env.BETTER_AUTH_SECRET!,
        hosted: false,
        permitsEmail: syntheticEmail,
        sendMail: (message) => captureLocalMail("test", message),
      }),
      db,
      pool: appPool,
      origin: control.runtime.origin,
      environment: "test",
    },
  };
  await migrate(world.owner.db, { migrationsFolder: "drizzle" });
  await world.owner.pool.query(runtimeGrantsSql);
  actor = await createAccount(world, ["admin"]);
  const session = await world.runtime.auth.api.getSession({
    headers: actor.headers,
  });
  if (!session) throw new Error("Actual MFA provider session required.");
  sessionId = session.session.id;
  const owner = await world.owner.pool.connect();
  try {
    await owner.query("BEGIN");
    await prepareLocalPolicies(owner);
    await prepareLocalStaff(owner, actor.id);
    await owner.query("COMMIT");
  } finally {
    await owner.query("ROLLBACK");
    owner.release();
  }
}, 30000);
afterAll(async () => {
  await closeWorld(world);
  if (created) await control.owner.pool.query(`DROP DATABASE ${database}`);
  await closeWorld(control);
});

async function target() {
  const account = await createAccount(world);
  expect(
    (
      await world.runtime.pool.query(
        "SELECT * FROM public.claim_local_workflow_task($1,$2,'account',$3,$4)",
        [actor.id, sessionId, account.id, randomUUID()],
      )
    ).rows[0].outcome,
  ).toBe("saved");
  return account;
}
async function state(id: string) {
  return (
    await world.owner.pool.query(
      "SELECT a.status,EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=a.user_id AND role='admin') AS admin FROM public.user_access a WHERE a.user_id=$1",
      [id],
    )
  ).rows[0];
}
async function settledOrBlocked(promise: Promise<unknown>, pid: number) {
  let settled = false;
  void promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (settled) return "settled";
    const row = (
      await world.owner.pool.query(
        "SELECT wait_event_type,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1",
        [pid],
      )
    ).rows[0];
    if (row?.wait_event_type === "Lock" && row.blockers.length)
      return "blocked";
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Expected actual SQL progress or lock wait.");
}
async function prepare(owner: PoolClient, id: string) {
  try {
    await prepareLocalStaff(owner, id);
    await owner.query("COMMIT");
    return "granted";
  } catch {
    await owner.query("ROLLBACK");
    return "refused";
  }
}
function restrict(client: PoolClient, id: string) {
  return client.query(
    "SELECT * FROM public.change_local_account_access($1,$2,$3,0,'suspended','local_restrict',$4)",
    [actor.id, sessionId, id, randomUUID()],
  );
}

describe("supported owner Admin preparation serializes with account restriction", () => {
  it("refuses owner preparation after restriction wins during an actual event FK wait", async () => {
    const account = await target(),
      blocker = await world.owner.pool.connect(),
      owner = await world.owner.pool.connect(),
      runtime = await world.runtime.pool.connect();
    let pendingRestriction: ReturnType<typeof restrict> | undefined,
      pendingPreparation: Promise<string> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query(
        'SELECT id FROM public."user" WHERE id=$1 FOR UPDATE',
        [actor.id],
      );
      const restrictionPid = (
          await runtime.query("SELECT pg_backend_pid() AS pid")
        ).rows[0].pid,
        ownerPid = (await owner.query("SELECT pg_backend_pid() AS pid")).rows[0]
          .pid;
      pendingRestriction = restrict(runtime, account.id);
      expect(await settledOrBlocked(pendingRestriction, restrictionPid)).toBe(
        "blocked",
      );
      await owner.query("BEGIN");
      pendingPreparation = prepare(owner, account.id);
      const ownerProgress = await settledOrBlocked(
        pendingPreparation,
        ownerPid,
      );
      await blocker.query("COMMIT");
      expect((await pendingRestriction).rows[0].outcome).toBe("saved");
      expect(await pendingPreparation).toBe("refused");
      expect(ownerProgress).toBe("blocked");
      expect(await state(account.id)).toEqual({
        status: "suspended",
        admin: false,
      });
      expect(
        (
          await world.owner.pool.query(
            "SELECT 1 FROM public.local_workflow_staff WHERE user_id=$1",
            [account.id],
          )
        ).rowCount,
      ).toBe(0);
    } finally {
      await blocker.query("ROLLBACK");
      await Promise.allSettled([pendingRestriction, pendingPreparation]);
      await owner.query("ROLLBACK");
      blocker.release();
      owner.release();
      runtime.release();
    }
  });
  it("refuses restriction after owner preparation commits first", async () => {
    const account = await target(),
      owner = await world.owner.pool.connect(),
      runtime = await world.runtime.pool.connect();
    let pendingRestriction: ReturnType<typeof restrict> | undefined;
    try {
      await owner.query("BEGIN");
      await prepareLocalStaff(owner, account.id);
      const pid = (await runtime.query("SELECT pg_backend_pid() AS pid"))
        .rows[0].pid;
      pendingRestriction = restrict(runtime, account.id);
      const restrictionProgress = await settledOrBlocked(
        pendingRestriction,
        pid,
      );
      await owner.query("COMMIT");
      expect((await pendingRestriction).rows[0].outcome).toBe("not_found");
      expect(restrictionProgress).toBe("blocked");
      expect(await state(account.id)).toEqual({
        status: "active",
        admin: true,
      });
      expect(
        (
          await world.owner.pool.query(
            "SELECT 1 FROM public.account_restriction_events WHERE target_user_id=$1",
            [account.id],
          )
        ).rowCount,
      ).toBe(0);
    } finally {
      await owner.query("ROLLBACK");
      await Promise.allSettled([pendingRestriction]);
      owner.release();
      runtime.release();
    }
  });
});
