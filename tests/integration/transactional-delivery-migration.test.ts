import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import net from "node:net";
import { Pool } from "pg";
import { createDatabase } from "@/lib/db/connection";
import { createLocalAuth } from "@/lib/auth-factory";
import { createAccount, closeWorld, type World } from "./support";
import {
  workflowFixture,
  historicalWorkflowBooking,
} from "../support/booking-workflows-fixtures";
import { loadCandidate } from "../../scripts/staging-migrations/journal";
import { verifyProtections } from "../../scripts/staging-migrations/protections";
import { runtimeGrantsSql } from "../../scripts/runtime-grants";
import { verifyRuntimeGrants } from "../../scripts/staging-migrations/privileges";
import { acceptedDeliveryPredecessor } from "../support/transactional-delivery-source";
import { currentDeliveryMaterial } from "@/features/transactional-delivery/recipient";
import { bindTransactionalDelivery } from "@/features/transactional-delivery/context";
import { drainTransactionalDeliveries } from "@/features/transactional-delivery/drain";
import { createBookingMessageConstructor } from "@/lib/email/transactional-message";
import { assertOwnedReadinessDatabase } from "../support/readiness-placement";
import { stagingTlsTestPort } from "../support/staging-tls";

const port = stagingTlsTestPort(
    process.env.LEARLI_STAGING_TEST_PORT ?? "56004",
  ),
  secret = randomBytes(32).toString("hex"),
  root = process.cwd();
const directory = path.join(
    root,
    ".local/transactional-delivery",
    `migration-${randomUUID()}`,
  ),
  data = path.join(directory, "data");
const candidate = loadCandidate(root),
  origin = "https://learli.example",
  identitySecret = "W4-private-synthetic-migration-key-only";
let control: Pool,
  started = false;
const bin = (name: string) =>
  path.join(process.env.PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin", name);
function run(name: string, args: string[]) {
  const r = spawnSync(bin(name), args, { encoding: "utf8" });
  if (r.status !== 0) {
    writeFileSync(
      path.join(directory, "failed-command.log"),
      `${r.stdout}\n${r.stderr}`,
      { mode: 0o600 },
    );
    throw new Error(
      "Owned W4 migration tool failed; private evidence retained.",
    );
  }
}
function connection(database: string) {
  return new Pool({
    host: "127.0.0.1",
    port,
    user: "learli_owner",
    password: secret,
    database,
  });
}
beforeAll(async () => {
  assertOwnedReadinessDatabase(process.cwd());
  const probe = net.createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", resolve);
  });
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(path.join(directory, "password"), secret, { mode: 0o600 });
  writeFileSync(path.join(directory, "owned"), root, { mode: 0o600 });
  run("initdb", [
    "-D",
    data,
    "-U",
    "learli_owner",
    "--auth=scram-sha-256",
    "--pwfile",
    path.join(directory, "password"),
    "--encoding=UTF8",
    "--locale=C",
  ]);
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    path.join(directory, "server.log"),
    "-o",
    `-h127.0.0.1 -p${port} -c unix_socket_directories='' -c timezone=UTC`,
    "-w",
    "start",
  ]);
  started = true;
  control = connection("postgres");
  await control.query(
    `CREATE ROLE learli_app LOGIN PASSWORD '${secret}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
  );
  await control.query(
    "REVOKE ALL ON PARAMETER session_replication_role FROM PUBLIC,learli_app",
  );
}, 60000);
afterAll(async () => {
  await control?.end();
  if (started) {
    if (readFileSync(path.join(directory, "owned"), "utf8") !== root)
      throw new Error("Owned migration marker mismatch.");
    run("pg_ctl", ["-D", data, "stop", "-m", "fast"]);
  }
});
async function apply(pool: Pool, from: number, until: number) {
  await pool.query(
    "CREATE SCHEMA IF NOT EXISTS drizzle; REVOKE ALL ON SCHEMA drizzle FROM PUBLIC,learli_app; CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations(id serial PRIMARY KEY,hash text NOT NULL,created_at bigint); REVOKE ALL ON drizzle.__drizzle_migrations FROM PUBLIC,learli_app",
  );
  await pool.query("BEGIN");
  try {
    for (const e of candidate.entries.slice(from, until)) {
      for (const query of e.statements)
        if (query.trim()) await pool.query(query);
      await pool.query(
        "INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES($1,$2)",
        [e.hash, e.when],
      );
    }
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}
async function records(pool: Pool, prior?: Record<string, string[]>) {
  const columns: Record<string, string[]> =
    prior ??
    Object.fromEntries(
      (
        await pool.query(
          "SELECT table_name,array_agg(column_name::text ORDER BY ordinal_position) columns FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name ORDER BY table_name",
        )
      ).rows.map((r) => [r.table_name, r.columns]),
    );
  const values: Record<string, string> = {},
    counts: Record<string, number> = {};
  for (const [table, names] of Object.entries(columns)) {
    if (!/^[a-z_]+$/.test(table) || names.some((n) => !/^\w+$/.test(n)))
      throw new Error("Unsafe fixture catalog.");
    const r = await pool.query(
      `SELECT to_jsonb(x) row FROM (SELECT ${names.map((n) => `"${n}"`).join(",")} FROM public."${table}") x ORDER BY to_jsonb(x)::text`,
    );
    counts[table] = r.rows.length;
    values[table] = createHash("sha256")
      .update(JSON.stringify(r.rows))
      .digest("hex");
  }
  return { columns, values, counts };
}
describe("W4 fresh and populated0026→0027 forward preservation", () => {
  it("retains immutable accepted historical SQL and exact supported predecessor snapshot", () => {
    expect(candidate.entries.length).toBeGreaterThanOrEqual(28);
    expect(candidate.entries[27].tag).toBe("0027_transactional_delivery");
    for (const [file, hash] of Object.entries(acceptedDeliveryPredecessor))
      expect(
        createHash("sha256").update(readFileSync(file)).digest("hex"),
        file,
      ).toBe(hash);
    expect(Object.keys(acceptedDeliveryPredecessor)).toHaveLength(27);
    const old = JSON.parse(
        readFileSync("drizzle/meta/0026_snapshot.json", "utf8"),
      ),
      next = JSON.parse(
        readFileSync("drizzle/meta/0027_snapshot.json", "utf8"),
      );
    expect(next.prevId).toBe(old.id);
  });
  it("fresh migrations enable exact guards/constraints and restricted runtime grants", async () => {
    await control.query("CREATE DATABASE w4_fresh OWNER learli_owner");
    const pool = connection("w4_fresh");
    try {
      await apply(pool, 0, candidate.entries.length);
      await pool.query(runtimeGrantsSql);
      const client = await pool.connect();
      try {
        await verifyProtections(client, candidate, candidate.entries.length);
        await verifyRuntimeGrants(client);
      } finally {
        client.release();
      }
      expect(
        (
          await pool.query(
            "SELECT count(*)::int n FROM transactional_deliveries",
          )
        ).rows[0].n,
      ).toBe(0);
      expect(
        (
          await pool.query(
            "SELECT has_table_privilege('learli_app','transactional_deliveries','INSERT') i,has_table_privilege('learli_app','transactional_deliveries','DELETE') d,has_function_privilege('learli_app','queue_transactional_delivery()','EXECUTE') x",
          )
        ).rows[0],
      ).toEqual({ i: false, d: false, x: false });
    } finally {
      await pool.end();
    }
  }, 60000);
  it("populated forward upgrade preserves every prior value, history and grant; old uncertainty blocks blind replay", async () => {
    await control.query("CREATE DATABASE learli_test OWNER learli_owner");
    const pool = connection("learli_test");
    let w: World | undefined;
    try {
      await apply(pool, 0, 27);
      // Apply the exact inherited policy without only the two newly introduced
      // table grant statements. All inherited function/table/column rights remain.
      await pool.query(
        runtimeGrantsSql
          .split("\n")
          .filter((line) => !line.includes("ON transactional_deliveries"))
          .join("\n"),
      );
      const url = (user: string) =>
        `postgresql://${user}:${secret}@127.0.0.1:${port}/learli_test`;
      w = {
        owner: createDatabase(url("learli_owner"), true),
        runtime: createLocalAuth({
          APP_ENV: "test",
          AUTH_MODE: "local",
          APP_URL: "http://127.0.0.1:3194",
          BETTER_AUTH_URL: "http://127.0.0.1:3194",
          BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
          DATABASE_URL: url("learli_app"),
        }),
      };
      const reviewer = await createAccount(
          w,
          ["admin"],
          "Fictional forward reviewer",
        ),
        fixture = await workflowFixture(w, reviewer);
      const created = new Date(Date.now() - 26 * 3600000),
        start = new Date(
          Math.ceil((Date.now() + 3 * 86400000) / 1800000) * 1800000,
        );
      const historical = await historicalWorkflowBooking(w, fixture, reviewer, {
        state: "confirmed",
        created,
        start,
        end: new Date(start.getTime() + 3600000),
        expires: new Date(created.getTime() + 600000),
      });
      const before = await records(pool);
      expect(
        Object.values(before.counts).filter((n) => n > 0).length,
      ).toBeGreaterThan(15);
      await apply(pool, 27, 28);
      await pool.query(runtimeGrantsSql);
      const after = await records(pool, before.columns);
      expect(after.values).toEqual(before.values);
      expect(after.counts).toEqual(before.counts);
      await apply(pool, 28, candidate.entries.length);
      await pool.query(runtimeGrantsSql);
      const inspect = await pool.connect();
      try {
        await verifyProtections(inspect, candidate, candidate.entries.length);
        await verifyRuntimeGrants(inspect);
      } finally {
        inspect.release();
      }
      expect(
        (
          await pool.query(
            "SELECT count(*)::int n FROM transactional_deliveries",
          )
        ).rows[0].n,
      ).toBe(0); // no fabricated backfill
      // One explicitly owner-created historical synthetic ambiguous attempt,
      // referencing the real pre-migration event/intended beneficiary. No API
      // acceptance or historical external mail is claimed by this fixture.
      const first = created.getTime() + 30_000;
      const material = await currentDeliveryMaterial(
        w.runtime.db,
        historical.eventId,
        fixture.requester.id,
        "workflow_confirmed",
        first,
      );
      expect(material).not.toBeNull();
      const constructed = createBookingMessageConstructor({
        appOrigin: origin,
        identitySecret,
      })(material);
      if (!constructed.ok)
        throw new Error("Historical synthetic material refused.");
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockRejectedValue(new Error("External HTTP forbidden"));
      const context = bindTransactionalDelivery(
        w.runtime.db,
        {
          enabled: true,
          environment: "test",
          appOrigin: origin,
          identitySecret,
          apiKey: "re_synthetic_w4_migration_test",
          sender: "sender@example.test",
          verifiedSender: {
            sender: "sender@example.test",
            environment: "test",
            appOrigin: origin,
          },
          allowedRecipients: [fixture.requester.email, fixture.tutor.email],
        },
        { fetch },
      );
      if (!context) throw new Error("Synthetic migration context refused.");
      await pool.query(
        "INSERT INTO transactional_deliveries(event_id,recipient_user_id,kind,state,created_at,payload,idempotency_key,payload_fingerprint,configuration_fingerprint,first_attempt_at,last_attempt_at,attempts,next_attempt_at,failure_code) VALUES($1,$2,'workflow_confirmed','uncertain',$3,$4,$5,$6,$7,$8,$8,1,$8,'timeout')",
        [
          historical.eventId,
          fixture.requester.id,
          created,
          material,
          constructed.message.idempotencyKey,
          constructed.message.payloadFingerprint,
          context.configurationFingerprint,
          new Date(first),
        ],
      );
      expect(
        (
          await drainTransactionalDeliveries(context, {
            eventId: historical.eventId,
          })
        ).blocked,
      ).toBe(1);
      expect(fetch).not.toHaveBeenCalled();
      expect(
        (
          await pool.query(
            "SELECT state,failure_code,first_attempt_at FROM transactional_deliveries WHERE event_id=$1",
            [historical.eventId],
          )
        ).rows[0],
      ).toEqual({
        state: "blocked",
        failure_code: "retention_elapsed",
        first_attempt_at: new Date(first),
      });
      writeFileSync(
        path.join(directory, "preservation.json"),
        JSON.stringify({
          status: "PASS",
          priorTables: Object.keys(before.columns).length,
          populatedTables: Object.values(before.counts).filter((n) => n > 0)
            .length,
          before: before.values,
          after: after.values,
          migrationCount: candidate.entries.length,
          noBackfill: true,
        }),
        { mode: 0o600 },
      );
    } finally {
      await closeWorld(w);
      await pool.end();
    }
  }, 90000);
});
