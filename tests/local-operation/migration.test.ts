import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { describe, expect, it } from "vitest";
import { createDatabase } from "@/lib/db/connection";
import { loadCandidate } from "../../scripts/staging-migrations/journal";
import { runtimeGrantsBeforeOperation } from "../support/migration-inventory";
import { runtimeGrantsSql } from "../../scripts/runtime-grants";
import { verifyRuntimeGrants } from "../../scripts/staging-migrations/privileges";
import { verifyProtections } from "../../scripts/staging-migrations/protections";
import { operationFixtureConfiguration } from "./support";

async function records(client: PoolClient, columns?: Record<string, string[]>) {
  const projection: Record<string, string[]> =
    columns ??
    Object.fromEntries(
      (
        await client.query(
          "SELECT table_name,array_agg(column_name::text ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name ORDER BY table_name",
        )
      ).rows.map((r) => [r.table_name, r.columns]),
    );
  const rows: Record<string, unknown> = {};
  for (const [table, names] of Object.entries(projection)) {
    if (!/^[a-z_]+$/.test(table) || names.some((n) => !/^\w+$/.test(n)))
      throw new Error("Invalid fixture projection.");
    rows[table] = (
      await client.query(
        `SELECT to_jsonb(t) AS row FROM(SELECT ${names.map((n) => `"${n}"`).join(",")} FROM public."${table}") t ORDER BY to_jsonb(t)::text`,
      )
    ).rows;
  }
  return { columns: projection, rows };
}
describe("0035–0037 ordinary operation forward migration preservation", () => {
  it.each(["fresh", "populated0034"] as const)(
    "preserves %s data and exact runtime protections",
    async (mode) => {
      const configuration = operationFixtureConfiguration(),
        root = configuration.checkout;
      const candidate = loadCandidate(root),
        owner = createDatabase(configuration.ownerUrl);
      const database = `learli_operation_${randomUUID().replaceAll("-", "")}`;
      let pool: Pool | undefined,
        created = false;
      const directory = await mkdtemp(
        path.join(tmpdir(), "learli-operation-baseline-"),
      );
      try {
        await owner.pool.query(
          `CREATE DATABASE ${database} OWNER learli_owner`,
        );
        created = true;
        await owner.pool.query(
          `REVOKE ALL ON DATABASE ${database} FROM PUBLIC;GRANT CONNECT ON DATABASE ${database} TO learli_app`,
        );
        pool = new Pool({
          ...owner.pool.options,
          // pg deliberately makes passwords non-enumerable on Pool.options.
          password: owner.pool.options.password,
          database,
          max: 1,
          statement_timeout: 15000,
        });
        const client = await pool.connect();
        try {
          let before: Awaited<ReturnType<typeof records>> | undefined;
          if (mode === "populated0034") {
            await mkdir(path.join(directory, "meta"), { mode: 0o700 });
            const journal = JSON.parse(
              await readFile(
                path.join(root, "drizzle/meta/_journal.json"),
                "utf8",
              ),
            );
            await writeFile(
              path.join(directory, "meta/_journal.json"),
              JSON.stringify({
                ...journal,
                entries: journal.entries.slice(0, 35),
              }),
              { mode: 0o600 },
            );
            for (const entry of candidate.entries.slice(0, 35))
              await writeFile(
                path.join(directory, `${entry.tag}.sql`),
                await readFile(path.join(root, "drizzle", `${entry.tag}.sql`)),
                { mode: 0o600 },
              );
            await migrate(drizzle(client), { migrationsFolder: directory });
            await client.query(runtimeGrantsBeforeOperation);
            const actor = randomUUID(),
              session = randomUUID();
            await client.query(
              "INSERT INTO public.\"user\"(id,name,email,email_verified) VALUES($1,'Preserved fictional guardian',$2,true)",
              [actor, `${actor}@learli.test`],
            );
            await client.query(
              "INSERT INTO public.user_access(user_id) VALUES($1)",
              [actor],
            );
            await client.query(
              "INSERT INTO public.user_roles(user_id,role) VALUES($1,'parent')",
              [actor],
            );
            await client.query(
              "INSERT INTO public.session(id,user_id,token,expires_at,created_at,updated_at) VALUES($1,$2,$3,now()+interval '1 day',now(),now())",
              [session, actor, randomUUID()],
            );
            expect(
              (
                await client.query(
                  "SELECT * FROM public.create_local_learner_with_grade($1,$2,$3,'guardian','Preserved child','middle_school','Asia/Manila',8)",
                  [actor, session, randomUUID()],
                )
              ).rows[0].outcome,
            ).toBe("created");
            before = await records(client);
          }
          await migrate(drizzle(client), {
            migrationsFolder: path.join(root, "drizzle"),
          });
          await client.query(runtimeGrantsSql);
          if (before)
            expect((await records(client, before.columns)).rows).toEqual(
              before.rows,
            );
          expect(
            (
              await client.query(
                "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
              )
            ).rows[0].count,
          ).toBe(candidate.entries.length);
          expect((await verifyRuntimeGrants(client)).functionChecks).toBe(95);
          await verifyProtections(client, candidate, candidate.entries.length);
          expect(
            (
              await client.query(
                "SELECT count(*)::int AS count FROM public.local_workflow_claims",
              )
            ).rows[0].count,
          ).toBe(0);
          expect(
            (
              await client.query(
                "SELECT count(*)::int AS count FROM public.local_workflow_staff",
              )
            ).rows[0].count,
          ).toBe(0);
        } finally {
          client.release();
        }
      } finally {
        await pool?.end();
        if (created)
          await owner.pool.query(`DROP DATABASE ${database} WITH (FORCE)`);
        await owner.pool.end();
        await rm(directory, { recursive: true, force: true });
      }
    },
    30000,
  );
});
