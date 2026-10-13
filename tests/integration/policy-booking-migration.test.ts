import { assertOwnedReadinessDatabase } from "../support/readiness-placement";
import { stagingTlsTestPort } from "../support/staging-tls";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import net from "node:net";
import { Pool } from "pg";
import { loadCandidate } from "../../scripts/staging-migrations/journal";
import {
  expectedProtections,
  verifyProtections,
} from "../../scripts/staging-migrations/protections";
import { runtimeGrantsSql } from "../../scripts/runtime-grants";
import { verifyRuntimeGrants } from "../../scripts/staging-migrations/privileges";
const port = stagingTlsTestPort(
    process.env.LEARLI_STAGING_TEST_PORT ?? "56006",
  ),
  dir = path.join(
    process.cwd(),
    ".local/booking-workflows",
    `migration-${randomUUID()}`,
  ),
  data = path.join(dir, "data"),
  secret = randomBytes(32).toString("hex");
let started = false,
  control: Pool;
const binary = (name: string) =>
  path.join(process.env.PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin", name);
function run(name: string, args: string[]) {
  const r = spawnSync(binary(name), args, { encoding: "utf8" });
  if (r.status !== 0)
    throw new Error(
      `Owned migration tool ${name} failed; private evidence retained.`,
    );
}
beforeAll(async () => {
  assertOwnedReadinessDatabase(process.cwd());
  const listener = net.createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(port, "127.0.0.1", resolve);
  });
  await new Promise<void>((r) => listener.close(() => r()));
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(path.join(dir, "owner-password"), secret, { mode: 0o600 });
  writeFileSync(path.join(dir, "owned"), process.cwd(), { mode: 0o600 });
  run("initdb", [
    "-D",
    data,
    "-U",
    "learli_owner",
    "--auth=scram-sha-256",
    "--pwfile",
    path.join(dir, "owner-password"),
    "--encoding=UTF8",
    "--locale=C",
  ]);
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    path.join(dir, "server.log"),
    "-o",
    `-h 127.0.0.1 -p ${port} -c unix_socket_directories='' -c timezone=UTC`,
    "-w",
    "start",
  ]);
  started = true;
  control = new Pool({
    host: "127.0.0.1",
    port,
    user: "learli_owner",
    password: secret,
    database: "postgres",
  });
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
    if (readFileSync(path.join(dir, "owned"), "utf8") !== process.cwd())
      throw new Error("Owned marker mismatch");
    run("pg_ctl", ["-D", data, "stop", "-m", "fast"]);
  }
});
const candidate = loadCandidate(process.cwd());
function connection(database: string) {
  return new Pool({
    host: "127.0.0.1",
    port,
    user: "learli_owner",
    password: secret,
    database,
  });
}
async function apply(p: Pool, until: number, from = 0) {
  await p.query(
    "CREATE SCHEMA IF NOT EXISTS drizzle; REVOKE ALL ON SCHEMA drizzle FROM PUBLIC,learli_app; CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations(id serial PRIMARY KEY, hash text NOT NULL, created_at bigint); REVOKE ALL ON drizzle.__drizzle_migrations FROM PUBLIC,learli_app",
  );
  await p.query("BEGIN");
  try {
    for (const e of candidate.entries.slice(from, until)) {
      for (const sql of e.statements) if (sql.trim()) await p.query(sql);
      await p.query(
        "INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES($1,$2)",
        [e.hash, e.when],
      );
    }
    await p.query("COMMIT");
  } catch (e) {
    await p.query("ROLLBACK");
    throw e;
  }
}
async function rows(p: Pool, shape?: Record<string, string[]>) {
  const columns: Record<string, string[]> =
    shape ??
    Object.fromEntries(
      (
        await p.query(
          "SELECT table_name,array_agg(column_name::text ORDER BY ordinal_position) AS cols FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name ORDER BY table_name",
        )
      ).rows.map((r) => [r.table_name, r.cols]),
    );
  const values: Record<string, string> = {};
  for (const [table, names] of Object.entries(columns)) {
    if (!/^[a-z_]+$/.test(table) || names.some((n) => !/^\w+$/.test(n)))
      throw new Error();
    const r = await p.query(
      `SELECT to_jsonb(x) AS row FROM (SELECT ${names.map((n) => '"' + n + '"').join(",")} FROM public."${table}") x ORDER BY to_jsonb(x)::text`,
    );
    values[table] = createHash("sha256")
      .update(JSON.stringify(r.rows))
      .digest("hex");
  }
  return { columns, values };
}
describe("W6 fresh and populated forward source/grant/preservation proof", () => {
  it("preserves all historical0000–0024 accepted source bytes and generated supported predecessor", () => {
    const acceptedPriorSources: Record<string, string> = {
      "drizzle/0022_admin_assurance.sql":
        "f97710076f37d68d791e13d0d285c8fb6e20912ef1be199e777f3f55c1b82256",
      "drizzle/0023_learner_admission.sql":
        "ca569cb2612032b7e1067c637b35fd58d57585214b82cc47acd49807204116c0",
      "drizzle/0024_screening_safeguarding.sql":
        "ef364337421eeeb8700b20001e16f1f2a39784d7b55c9e8340c822f9d6a8d4dd",
    };
    for (const e of candidate.entries.slice(0, 25)) {
      const file = `drizzle/${e.tag}.sql`,
        expected =
          acceptedPriorSources[file] ??
          createHash("sha256")
            .update(
              spawnSync("git", ["show", `2fa0294:${file}`], {
                encoding: "utf8",
              }).stdout,
            )
            .digest("hex");
      expect(e.hash, file).toBe(expected);
    }
    expect(candidate.entries[25]?.tag).toBe("0025_booking_workflows");
    const snapshot = JSON.parse(
        readFileSync("drizzle/meta/0025_snapshot.json", "utf8"),
      ),
      prior = JSON.parse(
        readFileSync("drizzle/meta/0024_snapshot.json", "utf8"),
      );
    expect(snapshot.prevId).toBe(prior.id);
  });
  it("fresh chain supports exact functions/triggers and narrowly granted readiness state", async () => {
    await control.query("CREATE DATABASE w6_fresh OWNER learli_owner");
    const p = connection("w6_fresh");
    try {
      await apply(p, candidate.entries.length);
      await p.query(runtimeGrantsSql);
      const client = await p.connect();
      try {
        const actual = await verifyProtections(
          client,
          candidate,
          candidate.entries.length,
        );
        expect(actual.functions).toBe(
          expectedProtections(candidate.entries.flatMap((e) => e.statements))
            .functions.length,
        );
        await verifyRuntimeGrants(client);
        expect(
          (
            await client.query(
              "SELECT pg_get_constraintdef(oid) AS shape FROM pg_constraint WHERE conname='bookings_tutor_no_overlap'",
            )
          ).rows[0].shape,
        ).toContain("provisional");
        expect(
          (
            await client.query(
              "SELECT has_table_privilege('learli_app','booking_workflow_grants','UPDATE') AS granted",
            )
          ).rows[0].granted,
        ).toBe(false);
      } finally {
        client.release();
      }
    } finally {
      await p.end();
    }
  }, 60000);
  it("populated0024→current retains every original column/row across every baseline public table", async () => {
    await control.query("CREATE DATABASE w6_upgrade OWNER learli_owner");
    const p = connection("w6_upgrade");
    try {
      await apply(p, 25);
      await p.query(
        `INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at,timezone) VALUES('w6-old-tutor','Fictional original tutor','w6-original-tutor@learli.test',true,clock_timestamp(),clock_timestamp(),'Asia/Manila'),('w6-old-parent','Fictional original parent','w6-original-parent@learli.test',true,clock_timestamp(),clock_timestamp(),'Asia/Manila')`,
      );
      await p.query(
        "INSERT INTO user_access(user_id,status) VALUES('w6-old-tutor','active'),('w6-old-parent','active');INSERT INTO user_roles(user_id,role) VALUES('w6-old-tutor','tutor'),('w6-old-parent','parent')",
      );
      const tutor = randomUUID(),
        learner = randomUUID(),
        booking = randomUUID(),
        oldCase = randomUUID();
      await p.query(
        "INSERT INTO tutor_profiles(id,user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,'w6-old-tutor','w6-original-tutor','Fictional original tutor','Fictional description','Fictional background','Asia/Manila','approved')",
        [tutor],
      );
      await p.query(
        "INSERT INTO learner_profiles(id,fixture_key,source,management,display_name,level,timezone,status) VALUES($1,'w6-original-learner','local_fixture','guardian','Fictional original learner','high_school','Asia/Manila','active')",
        [learner],
      );
      await p.query(
        "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES('w6-old-parent',$1,'local_fixture','authorized')",
        [learner],
      );
      const subject = (
        await p.query("SELECT id FROM subjects WHERE slug='math'")
      ).rows[0].id;
      await p.query("BEGIN");
      await p.query(
        "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) VALUES($1,'local_simulation',$2,$3,'w6-old-parent',$4,clock_timestamp()+interval '1 day',clock_timestamp()+interval '1 day 1 hour','Asia/Manila',$5,$6,'demo_reserved',clock_timestamp(),clock_timestamp()+interval '10 minutes')",
        [booking, tutor, learner, subject, randomUUID(), "a".repeat(64)],
      );
      await p.query(
        "INSERT INTO booking_events(booking_id,event) VALUES($1,'demo_reserved')",
        [booking],
      );
      await p.query("COMMIT");
      await p.query("BEGIN");
      await p.query(
        "INSERT INTO support_cases(id,requester_user_id,request_key,category,subject,body) VALUES($1,'w6-old-parent',$2,'general','Fictional historical support','Fictional original request')",
        [oldCase, randomUUID()],
      );
      await p.query(
        "INSERT INTO support_case_events(case_id,action,actor_user_id,next_status,revision) VALUES($1,'created','w6-old-parent','open',0)",
        [oldCase],
      );
      await p.query(
        "INSERT INTO support_case_bookings(case_id,booking_id) VALUES($1,$2)",
        [oldCase, booking],
      );
      await p.query("COMMIT");
      const before = await rows(p);
      expect(Object.keys(before.columns).length).toBeGreaterThanOrEqual(44);
      await apply(p, candidate.entries.length, 25);
      const after = await rows(p, before.columns);
      expect(after.values).toEqual(before.values);
      expect(
        (
          await p.query(
            "SELECT source,creation_transaction FROM support_cases WHERE id=$1",
            [oldCase],
          )
        ).rows[0],
      ).toEqual({ source: "local_synthetic", creation_transaction: null });
      const ledger = await p.query(
        "SELECT hash,created_at::text AS when FROM drizzle.__drizzle_migrations ORDER BY id",
      );
      expect(ledger.rows).toEqual(
        candidate.entries.map((e) => ({ hash: e.hash, when: String(e.when) })),
      );
      await expect(
        p.query(
          "UPDATE support_cases SET creation_transaction='forged' WHERE id=$1",
          [oldCase],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await p.query(runtimeGrantsSql);
      const client = await p.connect();
      try {
        await verifyRuntimeGrants(client);
        await verifyProtections(client, candidate, candidate.entries.length);
      } finally {
        client.release();
      }
      writeFileSync(
        path.join(dir, "preservation-proof.json"),
        JSON.stringify({
          tables: Object.keys(before.columns),
          before: before.values,
          after: after.values,
          baseline: 25,
          candidate: candidate.entries.length,
        }),
        { mode: 0o600 },
      );
    } finally {
      await p.end();
    }
  }, 60000);
});
