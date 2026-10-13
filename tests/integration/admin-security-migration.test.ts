import {
  currentMigrationFunctionCount,
  currentMigrationPublicTableCount,
} from "../support/migration-inventory";
import { randomUUID, createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { describe, it, expect } from "vitest";
import { openWorld, closeWorld } from "./support";
import { runtimeGrantsSql } from "../../scripts/runtime-grants";
import { verifyRuntimeGrants } from "../../scripts/staging-migrations/privileges";

describe("owned PostgreSQL0022 administrator assurance migration", () => {
  it("fresh and populated0021 forward migration preserve all44 original table projections and22 historical stamps", async () => {
    const phase = async (value: string) =>
      appendFile(
        ".local/hosted-readiness-wave/migration-phases.log",
        `${Date.now()}: ${value}\n`,
        { mode: 0o600 },
      );
    await mkdir(".local/hosted-readiness-wave", {
      recursive: true,
      mode: 0o700,
    });
    await phase("start");
    const world = openWorld();
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    ) as { entries: { tag: string; idx: number }[] };
    expect(journal.entries[22]).toMatchObject({
      idx: 22,
      tag: "0022_admin_assurance",
    });
    const baseline = path.resolve(".local/hosted-readiness-wave/baseline0021");
    await mkdir(path.join(baseline, "meta"), { recursive: true, mode: 0o700 });
    await writeFile(
      path.join(baseline, "meta/_journal.json"),
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, 22) }),
      { mode: 0o600 },
    );
    for (const entry of journal.entries.slice(0, 22))
      await writeFile(
        path.join(baseline, `${entry.tag}.sql`),
        await readFile(`drizzle/${entry.tag}.sql`),
        { mode: 0o600 },
      );
    const databases: string[] = [];
    try {
      for (const mode of ["fresh", "upgrade"] as const) {
        const name = `learli_w1_${mode}_${randomUUID().replaceAll("-", "")}`;
        databases.push(name);
        await world.owner.pool.query(
          `CREATE DATABASE ${name} OWNER learli_owner`,
        );
        await world.owner.pool.query(
          `REVOKE ALL ON DATABASE ${name} FROM PUBLIC; GRANT CONNECT ON DATABASE ${name} TO learli_app`,
        );
        const pool = new Pool({
          host: world.owner.pool.options.host,
          port: world.owner.pool.options.port,
          user: world.owner.pool.options.user,
          password: world.owner.pool.options.password,
          ssl: false,
          statement_timeout: 5000,
          connectionTimeoutMillis: 3000,
          database: name,
          max: 1,
        });
        const app = new Pool({
          host: world.runtime.pool.options.host,
          port: world.runtime.pool.options.port,
          user: world.runtime.pool.options.user,
          password: world.runtime.pool.options.password,
          ssl: false,
          statement_timeout: 5000,
          connectionTimeoutMillis: 3000,
          database: name,
          max: 1,
        });
        try {
          await phase(`${mode}: connected`);
          const db = drizzle(pool);
          if (mode === "fresh")
            await migrate(db, { migrationsFolder: "drizzle" });
          else {
            await migrate(db, { migrationsFolder: baseline });
            const id = randomUUID(),
              sessionId = randomUUID();
            // Historical synthetic data for migration preservation, no assurance/factor shortcut.
            await pool.query(
              'INSERT INTO public."user"(id,name,email,email_verified,created_at,updated_at) VALUES($1,$2,$3,true,now(),now())',
              [id, "Synthetic pre-MFA migration identity", `${id}@learli.test`],
            );
            await pool.query(
              "INSERT INTO public.user_access(user_id) VALUES($1);",
              [id],
            );
            await pool.query(
              "INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')",
              [id],
            );
            await pool.query(
              "INSERT INTO public.session(id,user_id,token,expires_at,created_at,updated_at) VALUES($1,$2,$3,now()+interval '1 day',now(),now())",
              [sessionId, id, randomUUID()],
            );
            const tables = (
              await pool.query(
                "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
              )
            ).rows.map((r) => r.tablename as string);
            expect(tables).toHaveLength(44);
            const snapshots: Record<
              string,
              { columns: string; rows: unknown }
            > = {};
            for (const table of tables) {
              const columns = (
                await pool.query(
                  "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
                  [table],
                )
              ).rows
                .map((r) => `"${String(r.column_name).replaceAll('"', '""')}"`)
                .join(",");
              snapshots[table] = {
                columns,
                rows: (
                  await pool.query(
                    `SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM (SELECT ${columns} FROM public."${table}") t`,
                  )
                ).rows[0].rows,
              };
            }
            const ledger = (
              await pool.query(
                "SELECT id,hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id",
              )
            ).rows;
            expect(ledger).toHaveLength(22);
            await migrate(db, { migrationsFolder: "drizzle" });
            for (const [table, snapshot] of Object.entries(snapshots))
              expect(
                (
                  await pool.query(
                    `SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM (SELECT ${snapshot.columns} FROM public."${table}") t`,
                  )
                ).rows[0].rows,
              ).toEqual(snapshot.rows);
            expect(
              (
                await pool.query(
                  "SELECT id,hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id LIMIT 22",
                )
              ).rows,
            ).toEqual(ledger);
            expect(
              (
                await pool.query(
                  "SELECT public.has_admin_assurance($1,$2,28800) AS allowed",
                  [id, sessionId],
                )
              ).rows[0].allowed,
            ).toBe(false);
            expect(
              (
                await pool.query(
                  'SELECT two_factor_enabled FROM public."user" WHERE id=$1',
                  [id],
                )
              ).rows[0].two_factor_enabled,
            ).toBe(false);
          }
          await phase(`${mode}: migrated/snapshot compared`);
          await pool.query(runtimeGrantsSql);
          await phase(`${mode}: grants applied`);
          const client = await pool.connect();
          try {
            expect((await verifyRuntimeGrants(client)).functionChecks).toBe(
              currentMigrationFunctionCount,
            );
            await phase(`${mode}: grants verified`);
          } finally {
            client.release();
          }
          const ledger = (
            await pool.query(
              "SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id",
            )
          ).rows.map((r) => r.hash as string);
          expect(ledger).toHaveLength(journal.entries.length);
          for (const [index, entry] of journal.entries.entries())
            expect(ledger[index]).toBe(
              createHash("sha256")
                .update(await readFile(`drizzle/${entry.tag}.sql`))
                .digest("hex"),
            );
          expect(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'",
              )
            ).rows[0].n,
          ).toBe(currentMigrationPublicTableCount);
          await expect(
            app.query("UPDATE user_roles SET role='admin' WHERE false"),
          ).rejects.toMatchObject({ code: "42501" });
          await expect(
            app.query(
              "UPDATE admin_security_events SET action='factor_verified' WHERE false",
            ),
          ).rejects.toMatchObject({ code: "42501" });
          await expect(
            app.query(
              "SELECT public.private_review_moderator_allowed('forged','forged',$1)",
              [randomUUID()],
            ),
          ).rejects.toMatchObject({ code: "42501" });
        } catch (error) {
          // This stage executes only reviewed DDL and synthetic migration probes;
          // no actual provider credential/request body is accepted by this report.
          await phase(
            `${mode}: original failure ${error instanceof Error ? error.message : "Unknown migration failure"}`,
          );
          throw error;
        } finally {
          await phase(`${mode}: closing`);
          await app.end();
          await pool.end();
        }
      }
    } finally {
      for (const name of databases)
        await world.owner.pool.query(`DROP DATABASE ${name}`);
      await closeWorld(world);
    }
  }, 60000);
});
