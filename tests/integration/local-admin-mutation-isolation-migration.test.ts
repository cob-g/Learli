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
import {
  runtimeGrantsBeforeParent,
  runtimeGrantsBeforeGrade,
  runtimeGrantsBeforeOperation,
  expectLocalOperationRowPreservation,
} from "../support/migration-inventory";

const currentCandidate = loadCandidate(process.cwd());
// Prove the original0031 isolation and its0032–0034 additions before later
// migrations intentionally extend these shared administrative functions.
const candidate = {
  ...currentCandidate,
  entries: currentCandidate.entries.slice(0, 35),
};
const names = [
  "change_local_account_access",
  "change_local_support_assignment",
  "review_local_tutor_application",
];
const signatures = [
  "public.change_local_account_access(text,text,text,integer,text,text,uuid)",
  "public.change_local_support_assignment(text,text,uuid,integer,text,text,uuid)",
  "public.review_local_tutor_application(text,text,uuid,text)",
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
async function rowHashes(client: PoolClient, beforeGrade = false) {
  const tables = (
    await client.query<{ name: string }>(
      "SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows;
  const hashes: Record<string, string> = {};
  for (const { name } of tables) {
    if (!/^[a-z_]+$/.test(name)) throw new Error("Invalid fixture table.");
    const rows = await client.query(
      `SELECT to_jsonb(t)${beforeGrade && name === "learner_profiles" ? " - 'grade'" : ""} AS row FROM public."${name}" t ORDER BY to_jsonb(t)::text`,
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
    path.join(tmpdir(), "learli-local-admin-isolation-"),
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
describe("0031 local administrative mutation isolation forward migration", () => {
  it("replaces exactly three current definitions with only an early guard and unchanged schema metadata", () => {
    expect(candidate.entries[31].tag).toBe(
      "0031_local_admin_mutation_isolation",
    );
    const statements = candidate.entries[31].statements.filter((s) => s.trim());
    expect(statements).toHaveLength(3);
    for (const [index, name] of names.entries()) {
      const original = candidate.entries[index === 2 ? 24 : 22].statements.find(
        (s) =>
          s
            .trim()
            .startsWith(
              `${index === 2 ? "CREATE" : "CREATE OR REPLACE"} FUNCTION public.${name}(`,
            ),
      );
      if (!original) throw new Error("Original reviewed function missing.");
      const kind = [
        "Local account access changes",
        "Local support assignment changes",
        "Local tutor application reviews",
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
      readFileSync("drizzle/meta/0030_snapshot.json", "utf8"),
    );
    const next = JSON.parse(
      readFileSync("drizzle/meta/0031_snapshot.json", "utf8"),
    );
    expect(next.prevId).toBe(prior.id);
    expect(next.id).not.toBe(prior.id);
    expect({ ...next, id: prior.id, prevId: prior.prevId }).toEqual(prior);
  });
  it.each([
    "fresh",
    "populated0030",
    "populated0031",
    "populated0032",
  ] as const)(
    "%s retains row/history/owner/search-path/execute ACL contracts and exact current protections",
    async (mode) => {
      assertOwnedReadinessDatabase(process.cwd());
      const world = openWorld();
      const database = `learli_local_admin_isolation_${randomUUID().replaceAll("-", "")}`;
      let pool: Pool | undefined;
      let created = false;
      try {
        if (!/^learli_local_admin_isolation_[a-f0-9]{32}$/.test(database))
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
            const baselineLength =
              mode === "populated0032"
                ? 33
                : mode === "populated0031"
                  ? 32
                  : 31;
            await apply(client, baselineLength);
            await client.query(
              baselineLength < 33
                ? runtimeGrantsBeforeParent
                : runtimeGrantsBeforeGrade,
            );
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
            await populateLocalHistory(client, parent, tutorOwner, tutor);
            const rows = await rowHashes(client),
              definitions = await functions(client);
            const ledger = (
              await client.query(
                "SELECT id,hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id",
              )
            ).rows;
            expect(ledger).toHaveLength(baselineLength);
            await apply(client, candidate.entries.length);
            // Existing columns stay byte-equivalent; the new grade column has
            // separate0034 preservation coverage and is included on reruns.
            expect(await rowHashes(client, true)).toEqual(rows);
            expect(
              (
                await client.query(
                  `SELECT id,hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id LIMIT ${baselineLength}`,
                )
              ).rows,
            ).toEqual(ledger);
            const after = await functions(client);
            expect(after).toHaveLength(
              definitions.length + (baselineLength < 33 ? 1 : 0) + 3,
            );
            expect(
              after.filter((f) => f.name === "enroll_parent_workspace"),
            ).toHaveLength(1);
            for (const old of definitions) {
              const next = after.find((f) => f.name === old.name);
              expect(next).toBeDefined();
              if (names.includes(old.name)) {
                expect({ ...next, body: old.body }).toEqual(old);
                expect(next?.body).toContain("ERRCODE='25001'");
              } else if (
                [
                  "booking_workflow_policy_current",
                  "has_booking_workflow_task",
                ].includes(old.name)
              ) {
                // The additive0033 policy upgrade changes only these two bodies.
                // Exact current bodies are verified below; metadata/ACLs persist.
                expect({ ...next, body: old.body }).toEqual(old);
                expect(next?.body).not.toBe(old.body);
              } else expect(next).toEqual(old);
            }
            // The exact metadata comparison above proves every inherited ACL.
            // New0034 functions/column rights are applied separately.
            await client.query(runtimeGrantsBeforeOperation);
            await verifyProtections(
              client,
              candidate,
              candidate.entries.length,
            );
          }
          await client.query(runtimeGrantsBeforeOperation);
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
          for (const statement of candidate.entries[31].statements) {
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
          // Current operation has separate source-aware bodies. Preserve every
          // historical row/column and function identity/owner/ACL before applying
          // its explicitly additive runtime grants; never replay0031 over it.
          const historicalRows = await rowHashes(client),
            inheritedFunctions = await functions(client);
          await apply(client, currentCandidate.entries.length);
          expectLocalOperationRowPreservation(
            historicalRows,
            await rowHashes(client),
          );
          const upgradedFunctions = await functions(client);
          for (const inherited of inheritedFunctions) {
            const upgraded = upgradedFunctions.find(
              (fn) => fn.oid === inherited.oid,
            );
            expect({ ...upgraded, body: inherited.body }).toEqual(inherited);
          }
          await client.query(runtimeGrantsSql);
          await verifyRuntimeGrants(client);
          await verifyProtections(
            client,
            currentCandidate,
            currentCandidate.entries.length,
          );
          const currentDefinitions = await functions(client),
            currentRows = await rowHashes(client);
          await apply(client, currentCandidate.entries.length);
          expect(await functions(client)).toEqual(currentDefinitions);
          expect(await rowHashes(client)).toEqual(currentRows);
          expect(
            (
              await client.query(
                "SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations",
              )
            ).rows[0].n,
          ).toBe(currentCandidate.entries.length);
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

// Owner-written historical fixtures obey the actual local source, FK and shape
// constraints. This preserves constrained history without inventing runtime proof.
async function populateLocalHistory(
  client: PoolClient,
  actor: string,
  tutorOwner: string,
  tutor: string,
) {
  const reviewer = randomUUID(),
    caseId = randomUUID();
  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO "user"(id,name,email,email_verified) VALUES($1,'Fictional preserved reviewer',$2,true)`,
      [reviewer, `${reviewer}@learli.test`],
    );
    await client.query("INSERT INTO user_access(user_id) VALUES($1)", [
      reviewer,
    ]);
    await client.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'admin'),($2,'admin')",
      [reviewer, actor],
    );
    await client.query(
      "INSERT INTO support_reviewers(user_id,source,status) VALUES($1,'local_fixture','authorized')",
      [reviewer],
    );
    await client.query(
      "INSERT INTO support_cases(id,requester_user_id,request_key,source,category,subject,body,revision) VALUES($1,$2,$3,'local_synthetic','safety','Fictional preserved concern','Fictional preserved body',1)",
      [caseId, tutorOwner, randomUUID()],
    );
    await client.query(
      "INSERT INTO support_case_events(case_id,action,actor_user_id,next_status,revision) VALUES($1,'created',$2,'open',0)",
      [caseId, tutorOwner],
    );
    await client.query(
      "INSERT INTO support_case_events(case_id,action,next_reviewer_id,revision) VALUES($1,'assigned',$2,1)",
      [caseId, reviewer],
    );
    await client.query(
      "INSERT INTO support_case_assignments(case_id,reviewer_user_id) VALUES($1,$2)",
      [caseId, reviewer],
    );
    await client.query(
      "INSERT INTO support_dispatch_grants(dispatcher_user_id,case_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
      [actor, caseId],
    );
    await client.query(
      "INSERT INTO support_reviewer_choices(case_id,reviewer_user_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
      [caseId, reviewer],
    );
    await client.query(
      "INSERT INTO support_dispatch_grant_events(case_id,user_id,kind,action) VALUES($1,$2,'dispatcher','authorized'),($1,$3,'reviewer_choice','authorized')",
      [caseId, actor, reviewer],
    );
    await client.query(
      "INSERT INTO support_assignment_events(case_id,actor_user_id,request_key,expected_revision,revision,kind,next_reviewer_id) VALUES($1,$2,$3,0,1,'assign',$4)",
      [caseId, actor, randomUUID(), reviewer],
    );
    await client.query(
      "INSERT INTO account_restriction_targets(user_id,source,revision) VALUES($1,'local_fixture',1)",
      [tutorOwner],
    );
    await client.query(
      "INSERT INTO account_restriction_grants(staff_user_id,target_user_id,status) VALUES($1,$2,'authorized')",
      [actor, tutorOwner],
    );
    await client.query(
      "INSERT INTO account_restriction_grant_events(staff_user_id,target_user_id,action) VALUES($1,$2,'authorized')",
      [actor, tutorOwner],
    );
    await client.query(
      "INSERT INTO account_restriction_events(actor_user_id,target_user_id,request_key,expected_revision,revision,previous_status,next_status,reason) VALUES($1,$2,$3,0,1,'active','suspended','local_access_test')",
      [actor, tutorOwner, randomUUID()],
    );
    await client.query(
      "UPDATE user_access SET status='suspended' WHERE user_id=$1",
      [tutorOwner],
    );
    await client.query(
      "INSERT INTO tutor_screening_staff(user_id,provenance,status,valid_until) VALUES($1,'local_fixture','authorized',clock_timestamp()+interval '1 hour')",
      [actor],
    );
    await client.query(
      "INSERT INTO tutor_screening_assignments(tutor_id,reviewer_user_id,provenance,status,assignment_revision) VALUES($1,$2,'local_fixture','authorized',0)",
      [tutor, actor],
    );
    await client.query(
      "INSERT INTO tutor_screening_events(tutor_id,kind,actor_user_id,assignment_revision) VALUES($1,'assignment',$2,0)",
      [tutor, actor],
    );
    await client.query(
      "UPDATE tutor_profiles SET review_status='approved' WHERE id=$1",
      [tutor],
    );
    await client.query(
      "INSERT INTO audit_events(actor_user_id,target_user_id,action) VALUES($1,$2,'tutor_review.approved')",
      [actor, tutorOwner],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  for (const table of [
    "account_restriction_events",
    "account_restriction_grant_events",
    "support_assignment_events",
    "audit_events",
    "tutor_screening_events",
  ])
    expect(
      (await client.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,
    ).toBe(1);
  expect(
    (await client.query("SELECT count(*)::int n FROM support_case_events"))
      .rows[0].n,
  ).toBe(2);
}
