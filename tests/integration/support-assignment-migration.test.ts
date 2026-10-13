import { currentMigrationCandidate } from "../support/migration-inventory";
import { randomUUID, createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { runtimeGrantsSql } from "../../scripts/runtime-grants";
import { openWorld, closeWorld } from "./support";
// Own-cluster disposable schema proof; never connects outside assigned local test configuration.
describe("support assignment forward migration", () => {
  it("fresh and baseline17 upgrade preserve every existing row and enforce narrow grants", async () => {
    mkdirSync(".local/local-completion-wave", { recursive: true });
    const phase = (value: string) =>
      appendFileSync(
        ".local/local-completion-wave/migration-phases.log",
        value + "\n",
      );
    const world = openWorld();
    phase("start");
    const databases: string[] = [];
    try {
      const files = (await readdir("drizzle"))
        .filter((f) => /^\d{4}_.+\.sql$/.test(f))
        .sort();
      expect(files).toEqual(
        currentMigrationCandidate.entries.map((entry) => `${entry.tag}.sql`),
      );
      const sources = await Promise.all(
        files.map(async (name) => ({
          name,
          sql: await readFile(`drizzle/${name}`, "utf8"),
        })),
      );
      for (const mode of ["fresh", "upgrade"] as const) {
        const name = `learli_support_${mode}_${randomUUID().replaceAll("-", "")}`;
        databases.push(name);
        await world.owner.pool.query(
          `CREATE DATABASE ${name} OWNER learli_owner`,
        );
        await world.owner.pool.query(
          `REVOKE ALL ON DATABASE ${name} FROM PUBLIC`,
        );
        await world.owner.pool.query(
          `GRANT CONNECT ON DATABASE ${name} TO learli_app`,
        );
        const connection = new Pool({
          host: world.owner.pool.options.host,
          port: world.owner.pool.options.port,
          user: world.owner.pool.options.user,
          password: world.owner.pool.options.password,
          connectionTimeoutMillis: 3000,
          ssl: false,
          database: name,
          max: 1,
          statement_timeout: 5000,
        });
        const app = new Pool({
          host: world.runtime.pool.options.host,
          port: world.runtime.pool.options.port,
          user: world.runtime.pool.options.user,
          password: world.runtime.pool.options.password,
          connectionTimeoutMillis: 3000,
          ssl: false,
          database: name,
          max: 1,
          statement_timeout: 5000,
        });
        try {
          const applied: string[] = [];
          for (const source of sources.slice(0, 17)) {
            phase(`${mode}: ${source.name}`);
            await connection.query(source.sql);
            applied.push(createHash("sha256").update(source.sql).digest("hex"));
          }
          const tables = (
            await connection.query(
              "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
            )
          ).rows.map((r) => r.tablename as string);
          if (mode === "upgrade") {
            const requester = randomUUID(),
              reviewer = randomUUID(),
              caseId = randomUUID();
            for (const id of [requester, reviewer])
              await connection.query(
                'INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES($1,$2,$3,true,now(),now())',
                [id, "Synthetic preservation fixture", `${id}@learli.test`],
              );
            await connection.query(
              "INSERT INTO support_reviewers(user_id,source,status) VALUES($1,'local_fixture','authorized')",
              [reviewer],
            );
            await connection.query(
              "INSERT INTO support_cases(id,requester_user_id,request_key,category,subject,body) VALUES($1,$2,$3,'safety','Synthetic preservation','Synthetic preservation body')",
              [caseId, requester, randomUUID()],
            );
            await connection.query(
              "INSERT INTO support_case_events(case_id,action,actor_user_id,next_status,revision) VALUES($1,'created',$2,'open',0)",
              [caseId, requester],
            );
            await connection.query(
              "INSERT INTO support_case_assignments(case_id,reviewer_user_id) VALUES($1,$2)",
              [caseId, reviewer],
            );
          }
          phase(`${mode}: before snapshot`);
          const before: Record<string, unknown> = {};
          const projections: Record<string, string> = {};
          for (const table of tables) {
            projections[table] = (
              await connection.query<{ column_name: string }>(
                "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
                [table],
              )
            ).rows
              .map(
                ({ column_name }) => `"${column_name.replaceAll('"', '""')}"`,
              )
              .join(",");
            before[table] = (
              await connection.query(
                `SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM (SELECT ${projections[table]} FROM "${table}") t`,
              )
            ).rows[0].rows;
          }
          phase(`${mode}: forward`);
          for (const source of sources.slice(17)) {
            phase(`${mode}: ${source.name}`);
            await connection.query(source.sql);
          }
          await connection.query(runtimeGrantsSql);
          for (const table of tables)
            expect(
              (
                await connection.query(
                  `SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM (SELECT ${projections[table]} FROM "${table}") t`,
                )
              ).rows[0].rows,
            ).toEqual(before[table]);
          expect(applied).toHaveLength(17);
          phase(`${mode}: function/grants`);
          const functionRow = (
            await connection.query(
              "SELECT prosecdef,proconfig,has_function_privilege('learli_app',oid,'EXECUTE') AS app,has_function_privilege('public',oid,'EXECUTE') AS public FROM pg_proc WHERE proname='change_local_support_assignment'",
            )
          ).rows[0];
          expect(functionRow).toMatchObject({
            prosecdef: true,
            proconfig: ["search_path=pg_catalog"],
            app: true,
            public: false,
          });
          for (const table of [
            "support_dispatch_grants",
            "support_reviewer_choices",
            "support_assignment_events",
          ]) {
            expect(
              (
                await connection.query(
                  "SELECT has_table_privilege('learli_app',$1,'SELECT') AS read,has_table_privilege('learli_app',$1,'INSERT,UPDATE,DELETE') AS write",
                  [table],
                )
              ).rows[0],
            ).toEqual({ read: true, write: false });
          }
          expect(
            (
              await connection.query(
                "SELECT has_table_privilege('learli_app','support_dispatch_grant_events','SELECT,INSERT,UPDATE,DELETE') AS allowed",
              )
            ).rows[0].allowed,
          ).toBe(false);
          await expect(
            app.query(
              "UPDATE support_dispatch_grants SET status='authorized' WHERE false",
            ),
          ).rejects.toMatchObject({ code: "42501" });
          expect(
            (
              await app.query(
                "SELECT * FROM public.change_local_support_assignment('forged','forged',$1,0,'forged','assign',$2)",
                [randomUUID(), randomUUID()],
              )
            ).rows[0].outcome,
          ).toBe("not_found");
          expect(
            (
              await connection.query(
                "SELECT count(*)::int AS n FROM support_assignment_events",
              )
            ).rows[0].n,
          ).toBe(0);
        } finally {
          phase(`${mode}: close`);
          await app.end();
          await connection.end();
        }
      }
    } finally {
      phase("cleanup");
      for (const name of databases)
        await world.owner.pool.query(`DROP DATABASE ${name}`);
      await closeWorld(world);
    }
  }, 30000);
});
