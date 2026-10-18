import { randomUUID } from "node:crypto";
import { readFile, mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { Pool, type PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { describe, it, expect } from "vitest";
import { openWorld, closeWorld } from "./support";
import { assertOwnedReadinessDatabase } from "../support/readiness-placement";
import {
  runtimeGrantsBeforeGrade,
  currentMigrationFunctionCount,
} from "../support/migration-inventory";
import { runtimeGrantsSql } from "../../scripts/runtime-grants";
import { loadCandidate } from "../../scripts/staging-migrations/journal";
import { verifyRuntimeGrants } from "../../scripts/staging-migrations/privileges";
import { verifyProtections } from "../../scripts/staging-migrations/protections";
import { provisionAdmissionPolicy } from "../support/learner-admission-fixtures";

const candidate = loadCandidate(process.cwd());
async function functions(client: PoolClient) {
  return (
    await client.query(`SELECT p.oid,p.proname AS name,p.prosrc,p.proowner,p.proacl::text,p.proconfig,p.prosecdef
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
    AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') ORDER BY p.proname`)
  ).rows;
}
async function records(
  client: PoolClient,
  original?: Record<string, string[]>,
) {
  const columns: Record<string, string[]> =
    original ??
    Object.fromEntries(
      (
        await client.query(`SELECT table_name,array_agg(column_name::text ORDER BY ordinal_position) AS columns
    FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name ORDER BY table_name`)
      ).rows.map((r) => [r.table_name, r.columns]),
    );
  const rows: Record<string, unknown> = {};
  for (const [table, names] of Object.entries(columns)) {
    if (!/^[a-z_]+$/.test(table) || names.some((name) => !/^\w+$/.test(name)))
      throw new Error("Invalid test projection.");
    rows[table] = (
      await client.query(
        `SELECT to_jsonb(t) AS row FROM (SELECT ${names.map((name) => `"${name}"`).join(",")} FROM public."${table}") t ORDER BY to_jsonb(t)::text`,
      )
    ).rows;
  }
  return { columns, rows };
}
async function applyBaseline(client: PoolClient, count = 34) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "learli-grade-baseline-"),
  );
  try {
    await mkdir(path.join(directory, "meta"), { mode: 0o700 });
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    await writeFile(
      path.join(directory, "meta/_journal.json"),
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, count) }),
      { mode: 0o600 },
    );
    for (const entry of candidate.entries.slice(0, count))
      await writeFile(
        path.join(directory, `${entry.tag}.sql`),
        await readFile(`drizzle/${entry.tag}.sql`),
        { mode: 0o600 },
      );
    await migrate(drizzle(client), { migrationsFolder: directory });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
describe("0034 optional school grade forward migration", () => {
  it.each(["fresh", "populated0033"] as const)(
    "%s preserves original data, receipts, functions and restricted grants",
    async (mode) => {
      assertOwnedReadinessDatabase(process.cwd());
      expect(candidate.entries[34]?.tag).toBe("0034_learner_school_grade");
      const world = openWorld(),
        database = `learli_grade_${randomUUID().replaceAll("-", "")}`;
      let pool: Pool | undefined,
        created = false;
      try {
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
          max: 2,
          statement_timeout: 10000,
          connectionTimeoutMillis: 3000,
        });
        const client = await pool.connect();
        try {
          if (mode === "populated0033") {
            await applyBaseline(client);
            await client.query(runtimeGrantsBeforeGrade);
            const actor = randomUUID(),
              session = randomUUID();
            await client.query(
              "INSERT INTO public.\"user\"(id,name,email,email_verified) VALUES($1,'Fictional preserved parent',$2,true)",
              [actor, `${actor}@learli.test`],
            );
            await client.query("INSERT INTO user_access(user_id) VALUES($1)", [
              actor,
            ]);
            await client.query(
              "INSERT INTO user_roles(user_id,role) VALUES($1,'parent'),($1,'student')",
              [actor],
            );
            await client.query(
              "INSERT INTO session(id,user_id,token,expires_at,created_at,updated_at) VALUES($1,$2,$3,now()+interval '1 day',now(),now())",
              [session, actor, randomUUID()],
            );
            await client.query(
              "SELECT * FROM public.create_local_learner($1,$2,$3,'guardian','Fictional legacy child','middle_school','Asia/Manila')",
              [actor, session, randomUUID()],
            );
            await client.query(
              "SELECT * FROM public.create_local_learner($1,$2,$3,'self','Fictional legacy College','college_support','UTC')",
              [actor, session, randomUUID()],
            );
            const policy = await provisionAdmissionPolicy(pool!);
            await client.query(
              "SELECT * FROM public.create_learner_admission($1,$2,$3,$4,'guardian','Fictional pending child','high_school','UTC',NULL)",
              [actor, session, randomUUID(), policy.policyId],
            );
            const before = await records(client),
              oldFunctions = await functions(client);
            const ledger = (
              await client.query(
                "SELECT id,hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id",
              )
            ).rows;
            expect(ledger).toHaveLength(34);
            expect(
              (
                await client.query(
                  "SELECT count(*)::int AS n FROM learner_profiles",
                )
              ).rows[0].n,
            ).toBe(3);
            // Verify the historical0034 contract before later ordinary-operation
            // migrations intentionally extend shared function source semantics.
            await applyBaseline(client, 35);
            expect((await records(client, before.columns)).rows).toEqual(
              before.rows,
            );
            expect(
              (
                await client.query(
                  "SELECT id,hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id LIMIT 34",
                )
              ).rows,
            ).toEqual(ledger);
            const currentFunctions = await functions(client);
            expect(currentFunctions).toHaveLength(oldFunctions.length + 3);
            for (const fn of oldFunctions)
              expect(currentFunctions.find((f) => f.oid === fn.oid)).toEqual(
                fn,
              );
            // New rights require deliberate application; every old ACL already persisted.
            expect(
              (
                await client.query(
                  "SELECT count(*)::int AS n FROM pg_proc WHERE proname LIKE '%_with_grade' AND has_function_privilege('learli_app',oid,'EXECUTE')",
                )
              ).rows[0].n,
            ).toBe(0);
            expect(
              (await client.query("SELECT grade FROM learner_profiles")).rows,
            ).toEqual([{ grade: null }, { grade: null }, { grade: null }]);
          }
          await migrate(drizzle(client), { migrationsFolder: "drizzle" });
          await client.query(runtimeGrantsSql);
          expect((await verifyRuntimeGrants(client)).functionChecks).toBe(
            currentMigrationFunctionCount,
          );
          expect(
            (
              await verifyProtections(
                client,
                candidate,
                candidate.entries.length,
              )
            ).functions,
          ).toBe(currentMigrationFunctionCount);
          expect(
            (
              await client.query(
                "SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_name='learner_profiles' AND column_name='grade'",
              )
            ).rows,
          ).toEqual([
            {
              column_name: "grade",
              data_type: "integer",
              is_nullable: "YES",
              column_default: null,
            },
          ]);
          expect(
            (
              await client.query(
                "SELECT convalidated AS valid FROM pg_constraint WHERE conname='learner_profiles_grade'",
              )
            ).rows,
          ).toEqual([{ valid: true }]);
          const beforeRepeat = await records(client);
          await migrate(drizzle(client), { migrationsFolder: "drizzle" });
          await client.query(runtimeGrantsSql);
          expect((await records(client)).rows).toEqual(beforeRepeat.rows);
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
