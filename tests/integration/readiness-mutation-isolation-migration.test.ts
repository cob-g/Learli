import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { describe, it, expect } from "vitest";
import { openWorld, closeWorld } from "./support";
import { assertOwnedReadinessDatabase } from "../support/readiness-placement";
import {
  loadCandidate,
  digest,
} from "../../scripts/staging-migrations/journal";
import {
  expectedProtections,
  verifyProtections,
} from "../../scripts/staging-migrations/protections";
import { verifyRuntimeGrants } from "../../scripts/staging-migrations/privileges";
import { runtimeGrantsSql } from "../../scripts/runtime-grants";
import { runtimeGrantsBeforeParent } from "../support/migration-inventory";

// Keep this historical proof pinned to its exact 0000–0030 prefix.
// Later migrations have their own fresh/upgrade preservation tests.
const currentCandidate = loadCandidate(process.cwd());
const candidate = {
  ...currentCandidate,
  entries: currentCandidate.entries.slice(0, 31),
};
const names = [
  "record_tutor_screening_check",
  "change_safeguarding_response",
  "change_safeguarding_access",
];
const signatures = [
  "public.record_tutor_screening_check(text,text,uuid,integer,uuid,text,text,text,timestamptz,timestamptz)",
  "public.change_safeguarding_response(text,text,uuid,integer,uuid,text,text)",
  "public.change_safeguarding_access(text,text,text,integer,text,text,uuid)",
];
async function functions(client: PoolClient) {
  return (
    await client.query<{
      name: string;
      body: string;
      owner: number;
      acl: string;
      config: string[];
      definer: boolean;
      oid: number;
    }>(`
    SELECT p.oid,p.proname AS name,p.prosrc AS body,p.proowner AS owner,p.proacl::text AS acl,p.proconfig AS config,p.prosecdef AS definer
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') ORDER BY p.proname`)
  ).rows;
}
async function rowHashes(client: PoolClient) {
  const tables = (
    await client.query<{ name: string }>(
      "SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows;
  const hashes: Record<string, string> = {};
  for (const { name } of tables) {
    if (!/^[a-z_]+$/.test(name)) throw new Error("Invalid fixture table.");
    const rows = await client.query(
      `SELECT to_jsonb(t) AS row FROM public."${name}" t ORDER BY to_jsonb(t)::text`,
    );
    hashes[name] = digest(JSON.stringify(rows.rows));
  }
  return hashes;
}
async function apply(client: PoolClient, until: number) {
  if (until === currentCandidate.entries.length) {
    // The public migrator skips the already-recorded canonical prefix on upgrade.
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
    return;
  }
  const baseline = await mkdtemp(
    path.join(tmpdir(), "learli-readiness-isolation-"),
  );
  try {
    const entries = candidate.entries.slice(0, until);
    await mkdir(path.join(baseline, "meta"), { mode: 0o700 });
    await writeFile(
      path.join(baseline, "meta/_journal.json"),
      JSON.stringify({
        version: "7",
        dialect: "postgresql",
        entries: entries.map(({ idx, tag, when }) => ({
          idx,
          version: "7",
          tag,
          when,
          breakpoints: true,
        })),
      }),
      { mode: 0o600 },
    );
    for (const entry of entries) {
      const sql = readFileSync(`drizzle/${entry.tag}.sql`);
      expect(digest(sql)).toBe(entry.hash);
      await writeFile(path.join(baseline, `${entry.tag}.sql`), sql, {
        mode: 0o600,
      });
    }
    await migrate(drizzle(client), { migrationsFolder: baseline });
  } finally {
    await rm(baseline, { recursive: true, force: true });
  }
}
describe("0030 readiness mutation isolation forward migration", () => {
  it("replaces exactly three current definitions with only an early guard and unchanged schema metadata", () => {
    expect(candidate.entries[30].tag).toBe("0030_readiness_mutation_isolation");
    const statements = candidate.entries[30].statements.filter((s) => s.trim());
    expect(statements).toHaveLength(3);
    for (const [index, name] of names.entries()) {
      const original = candidate.entries[24].statements.find((s) =>
        s.trim().startsWith(`CREATE FUNCTION public.${name}(`),
      );
      if (!original) throw new Error("Original reviewed function missing.");
      const kind = [
        "Screening checks",
        "Safeguarding response changes",
        "Safeguarding access changes",
      ][index];
      const expected = original
        .trim()
        .replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION")
        .replace(
          "BEGIN\n",
          `BEGIN\n IF current_setting('transaction_isolation') IS DISTINCT FROM 'read committed' THEN RAISE EXCEPTION '${kind} require read committed' USING ERRCODE='25001';END IF;\n`,
        );
      expect(
        statements[index].replace(/^(?:\s|--[^\n]*(?:\n|$))*/, "").trim(),
      ).toBe(expected);
    }
    const prior = JSON.parse(
      readFileSync("drizzle/meta/0029_snapshot.json", "utf8"),
    );
    const next = JSON.parse(
      readFileSync("drizzle/meta/0030_snapshot.json", "utf8"),
    );
    expect(next.prevId).toBe(prior.id);
    expect(next.id).not.toBe(prior.id);
    expect({ ...next, id: prior.id, prevId: prior.prevId }).toEqual(prior);
  });
  it.each(["fresh", "populated0029"] as const)(
    "%s retains row/history/owner/search-path/execute ACL contracts and exact current protections",
    async (mode) => {
      assertOwnedReadinessDatabase(process.cwd());
      const world = openWorld();
      const database = `learli_readiness_isolation_${randomUUID().replaceAll("-", "")}`;
      let pool: Pool | undefined;
      let created = false;
      try {
        if (!/^learli_readiness_isolation_[a-f0-9]{32}$/.test(database))
          throw new Error("Invalid disposable test database name.");
        await world.owner.pool.query(
          `CREATE DATABASE ${database} OWNER learli_owner`,
        );
        created = true;
        await world.owner.pool.query(
          `REVOKE ALL ON DATABASE ${database} FROM PUBLIC; GRANT CONNECT ON DATABASE ${database} TO learli_app`,
        );
        pool = new Pool({
          host: world.owner.pool.options.host,
          port: world.owner.pool.options.port,
          user: world.owner.pool.options.user,
          password: world.owner.pool.options.password,
          database,
          ssl: false,
          max: 1,
          statement_timeout: 10000,
          connectionTimeoutMillis: 3000,
        });
        const client = await pool.connect();
        try {
          expect(
            (
              await client.query(
                "SELECT current_database() AS name,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=current_database()",
              )
            ).rows[0],
          ).toEqual({ name: database, owner: "learli_owner" });
          if (mode === "fresh") await apply(client, candidate.entries.length);
          else {
            await apply(client, 30);
            await client.query(runtimeGrantsBeforeParent);
            const parent = randomUUID(),
              tutorOwner = randomUUID(),
              learner = randomUUID(),
              tutor = randomUUID();
            await client.query(
              `INSERT INTO "user"(id,name,email,email_verified) VALUES($1,'Fictional preserved parent',$2,true),($3,'Fictional preserved tutor',$4,true)`,
              [
                parent,
                `${parent}@learli.test`,
                tutorOwner,
                `${tutorOwner}@learli.test`,
              ],
            );
            await client.query(
              "INSERT INTO user_access(user_id) VALUES($1),($2);",
              [parent, tutorOwner],
            );
            await client.query(
              "INSERT INTO user_roles(user_id,role) VALUES($1,'parent'),($2,'tutor')",
              [parent, tutorOwner],
            );
            await client.query(
              "INSERT INTO learner_profiles(id,fixture_key,source,management,display_name,level,timezone,status) VALUES($1,$2,'local_fixture','guardian','Fictional preserved learner','elementary','Asia/Manila','active')",
              [learner, learner],
            );
            await client.query(
              "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
              [parent, learner],
            );
            await client.query(
              "INSERT INTO tutor_profiles(id,user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,$3,'Fictional tutor','Fictional preserved bio','Fictional background','UTC','pending')",
              [tutor, tutorOwner, `synthetic-${tutor}`],
            );
            await populateReadinessHistory(client, parent, tutorOwner, tutor);
            const rows = await rowHashes(client),
              definitions = await functions(client);
            const ledger = (
              await client.query(
                "SELECT id,hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id",
              )
            ).rows;
            expect(ledger).toHaveLength(30);
            await apply(client, candidate.entries.length);
            expect(await rowHashes(client)).toEqual(rows);
            expect(
              (
                await client.query(
                  "SELECT id,hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id LIMIT 30",
                )
              ).rows,
            ).toEqual(ledger);
            const after = await functions(client);
            expect(after).toHaveLength(definitions.length);
            for (const old of definitions) {
              const next = after.find((f) => f.name === old.name);
              expect(next).toBeDefined();
              if (names.includes(old.name)) {
                expect({ ...next, body: old.body }).toEqual(old);
                expect(next?.body).toContain("ERRCODE='25001'");
              } else expect(next).toEqual(old);
            }
            // The exact function comparison above proves unchanged owner/ACLs
            // before any re-grant. Current global policy is verified after the
            // historical proof upgrades to the latest schema below.
          }
          await client.query(runtimeGrantsBeforeParent);
          const protections = await verifyProtections(
            client,
            candidate,
            candidate.entries.length,
          );
          expect(protections.functions).toBe(
            expectedProtections(candidate.entries.flatMap((e) => e.statements))
              .functions.length,
          );
          expect(
            (
              await client.query(
                "SELECT hash,created_at::text AS when FROM drizzle.__drizzle_migrations ORDER BY id",
              )
            ).rows,
          ).toEqual(
            candidate.entries.map((e) => ({
              hash: e.hash,
              when: String(e.when),
            })),
          );
          const beforeRerun = await functions(client);
          const rowsBeforeRerun = await rowHashes(client);
          await apply(client, candidate.entries.length);
          expect(await functions(client)).toEqual(beforeRerun);
          for (const statement of candidate.entries[30].statements) {
            if (statement.trim()) await client.query(statement);
          }
          expect(await functions(client)).toEqual(beforeRerun);
          expect(await rowHashes(client)).toEqual(rowsBeforeRerun);
          await verifyProtections(client, candidate, candidate.entries.length);
          expect(
            (
              await client.query(
                "SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations",
              )
            ).rows[0].n,
          ).toBe(candidate.entries.length);
          for (const signature of signatures) {
            const rights = await client.query(
              `SELECT has_function_privilege('learli_app',$1,'EXECUTE') AS runtime,
            EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=$1::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE') AS public`,
              [signature],
            );
            expect(rights.rows[0]).toEqual({ runtime: true, public: false });
          }
          // Retain the pinned historical proof, then verify the exact current
          // privilege policy after an actual additive forward upgrade. Inspect
          // inherited ACLs before reapplying any current grant statements.
          const historicalRows = await rowHashes(client);
          await apply(client, currentCandidate.entries.length);
          expect(await rowHashes(client)).toEqual(historicalRows);
          await verifyRuntimeGrants(client);
          await client.query(runtimeGrantsSql);
          await verifyRuntimeGrants(client);
          await verifyProtections(
            client,
            currentCandidate,
            currentCandidate.entries.length,
          );
        } finally {
          client.release();
        }
      } finally {
        await pool?.end();
        if (created) await world.owner.pool.query(`DROP DATABASE ${database}`);
        await closeWorld(world);
      }
    },
    60000,
  );
});

// Deliberate owner-written synthetic historical rows in this disposable database.
// These test preservation, not policy activation or a fabricated runtime action.
async function populateReadinessHistory(
  client: PoolClient,
  parent: string,
  tutorOwner: string,
  tutor: string,
) {
  const version = `synthetic-${randomUUID()}`,
    check = randomUUID(),
    caseId = randomUUID();
  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO tutor_screening_policies(provenance,version,reference,authority_reference,required_check_codes,allowed_actions,expiry_rule,valid_from,valid_until)
      VALUES('synthetic_readiness',$1,$2,$3,ARRAY['synthetic_check_a'],ARRAY['approve'],'all_checks_current',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour')`,
      [version, `policy:${randomUUID()}`, `synthetic:${randomUUID()}`],
    );
    await client.query(
      "INSERT INTO tutor_screening_cases(tutor_id,provenance,policy_version,revision) VALUES($1,'synthetic_readiness',$2,1)",
      [tutor, version],
    );
    await client.query(
      `INSERT INTO tutor_screening_checks(id,tutor_id,provenance,policy_version,round,expected_revision,revision,actor_user_id,assignment_revision,request_key,check_code,outcome,evidence_reference,checked_at,expires_at)
      VALUES($1,$2,'synthetic_readiness',$3,1,0,1,$4,0,$5,'synthetic_check_a','passed',$6,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour')`,
      [
        check,
        tutor,
        version,
        parent,
        randomUUID(),
        `screening:${randomUUID()}`,
      ],
    );
    await client.query(
      "INSERT INTO tutor_screening_events(tutor_id,revision,kind,actor_user_id,request_key,check_id,assignment_revision) VALUES($1,1,'check',$2,$3,$4,0)",
      [tutor, parent, randomUUID(), check],
    );
    await client.query(
      "INSERT INTO support_reviewers(user_id,source,status,valid_until) VALUES($1,'synthetic_readiness','authorized',clock_timestamp()+interval '1 hour'),($2,'synthetic_readiness','authorized',clock_timestamp()+interval '1 hour')",
      [parent, tutorOwner],
    );
    await client.query(
      `INSERT INTO support_response_policies(provenance,version,reference,valid_from,valid_until,responsible_owner_id,escalation_owner_id,reporting_guidance_reference,meeting_guidance_reference,allowed_actions,reason_codes)
      VALUES('synthetic_readiness',$1,$2,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour',$3,$4,$5,$6,ARRAY['intake','restrict','restore'],ARRAY['synthetic_safety_restrict','synthetic_safety_restore'])`,
      [
        version,
        `policy:${randomUUID()}`,
        parent,
        tutorOwner,
        `synthetic:${randomUUID()}`,
        `synthetic:${randomUUID()}`,
      ],
    );
    await client.query(
      "INSERT INTO support_cases(id,requester_user_id,request_key,source,category,subject,body) VALUES($1,$2,$3,'synthetic_readiness','safety','Fictional preserved concern','Fictional preserved body')",
      [caseId, parent, randomUUID()],
    );
    await client.query(
      "INSERT INTO support_case_responses(case_id,provenance,policy_version) VALUES($1,'synthetic_readiness',$2)",
      [caseId, version],
    );
    await client.query(
      "INSERT INTO support_case_events(case_id,action,actor_user_id,next_status,revision) VALUES($1,'created',$2,'open',0)",
      [caseId, parent],
    );
    await client.query(
      "INSERT INTO support_response_events(case_id,action,actor_user_id,request_key,expected_revision,revision,provenance,policy_version,response_cycle) VALUES($1,'intake',$2,$3,0,0,'synthetic_readiness',$4,1)",
      [caseId, parent, randomUUID(), version],
    );
    await client.query(
      "INSERT INTO account_restriction_targets(user_id,source,revision) VALUES($1,'synthetic_readiness',1)",
      [tutorOwner],
    );
    await client.query(
      "INSERT INTO account_restriction_events(actor_user_id,target_user_id,request_key,expected_revision,revision,previous_status,next_status,reason,policy_provenance,policy_version) VALUES($1,$2,$3,0,1,'active','suspended','synthetic_safety_restrict','synthetic_readiness',$4)",
      [parent, tutorOwner, randomUUID(), version],
    );
    await client.query(
      "UPDATE user_access SET status='suspended' WHERE user_id=$1",
      [tutorOwner],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  for (const table of [
    "tutor_screening_checks",
    "tutor_screening_events",
    "support_case_responses",
    "support_case_events",
    "support_response_events",
    "account_restriction_events",
  ]) {
    expect(
      (await client.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,
    ).toBe(1);
  }
}
