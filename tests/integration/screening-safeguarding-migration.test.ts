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

describe("owned PostgreSQL0024 screening safeguarding migration", () => {
  it("fresh and populated0023 forward migration preserves all55 original projections and24 historical stamps", async () => {
    await mkdir(".local/screening-safeguarding", {
      recursive: true,
      mode: 0o700,
    });
    const phase = async (value: string) =>
      appendFile(
        ".local/screening-safeguarding/migration-phases.log",
        `${Date.now()}: ${value}\n`,
        { mode: 0o600 },
      );
    await phase("start");
    const world = openWorld();
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    ) as { entries: { tag: string; idx: number }[] };
    expect(journal.entries[24]).toMatchObject({
      idx: 24,
      tag: "0024_screening_safeguarding",
    });
    const baseline = path.resolve(".local/screening-safeguarding/baseline0023");
    await mkdir(path.join(baseline, "meta"), { recursive: true, mode: 0o700 });
    await writeFile(
      path.join(baseline, "meta/_journal.json"),
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, 24) }),
      { mode: 0o600 },
    );
    for (const entry of journal.entries.slice(0, 24))
      await writeFile(
        path.join(baseline, `${entry.tag}.sql`),
        await readFile(`drizzle/${entry.tag}.sql`),
        { mode: 0o600 },
      );
    const databases: string[] = [];
    try {
      for (const mode of ["fresh", "upgrade"] as const) {
        const name = `learli_w8_${mode}_${randomUUID().replaceAll("-", "")}`;
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
            // Both relations changed by0023 contain representative legacy data.
            const guardianActive = randomUUID(),
              guardianRevoked = randomUUID(),
              self = randomUUID();
            await pool.query(
              "INSERT INTO user_roles(user_id,role) VALUES($1,'parent'),($1,'student')",
              [id],
            );
            await pool.query(
              `INSERT INTO learner_profiles(id,fixture_key,source,management,user_id,display_name,level,timezone,status)
              VALUES($1::uuid,$1::text,'local_fixture','guardian',NULL,'Synthetic legacy guardian learner','elementary','Asia/Manila','active'),
              ($2::uuid,$2::text,'local_fixture','guardian',NULL,'Synthetic revoked legacy relation','high_school','UTC','active'),
              ($3::uuid,$3::text,'local_fixture','self',$4,'Synthetic legacy independent College','college_support','America/New_York','active')`,
              [guardianActive, guardianRevoked, self, id],
            );
            await pool.query(
              "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized'),($1,$3,'local_fixture','revoked')",
              [id, guardianActive, guardianRevoked],
            );
            const tutorOwner = randomUUID(),
              legacyTutor = randomUUID(),
              legacyCase = randomUUID();
            await pool.query(
              `INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES($1,'Fictional legacy tutor',$2,true,now(),now())`,
              [tutorOwner, `${tutorOwner}@learli.test`],
            );
            await pool.query("INSERT INTO user_access(user_id) VALUES($1)", [
              tutorOwner,
            ]);
            await pool.query(
              "INSERT INTO user_roles(user_id,role) VALUES($1,'tutor')",
              [tutorOwner],
            );
            await pool.query(
              "INSERT INTO tutor_profiles(id,user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,$3,'Fictional','Fictional','Fictional','UTC','approved')",
              [legacyTutor, tutorOwner, "legacy-" + legacyTutor],
            );
            await pool.query(
              "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) SELECT $1,id,ARRAY['college_support']::text[] FROM subjects WHERE slug='math'",
              [legacyTutor],
            );
            await pool.query(
              "INSERT INTO support_reviewers(user_id,source,status) VALUES($1,'local_fixture','authorized')",
              [id],
            );
            await pool.query(
              "INSERT INTO support_cases(id,requester_user_id,request_key,source,category,subject,body) VALUES($1,$2,$3,'local_synthetic','safety','Fictional legacy subject','Fictional legacy body')",
              [legacyCase, tutorOwner, randomUUID()],
            );
            await pool.query(
              "INSERT INTO support_case_events(case_id,action,actor_user_id,next_status,revision) VALUES($1,'created',$2,'open',0)",
              [legacyCase, tutorOwner],
            );
            await pool.query(
              "INSERT INTO support_dispatch_grants(dispatcher_user_id,case_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
              [id, legacyCase],
            );
            await pool.query(
              "INSERT INTO support_reviewer_choices(reviewer_user_id,case_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
              [id, legacyCase],
            );
            await pool.query(
              "INSERT INTO account_restriction_targets(user_id,source) VALUES($1,'local_fixture')",
              [tutorOwner],
            );
            await pool.query(
              "INSERT INTO account_restriction_grants(staff_user_id,target_user_id,status) VALUES($1,$2,'authorized')",
              [id, tutorOwner],
            );
            const tables = (
              await pool.query(
                "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
              )
            ).rows.map((r) => r.tablename as string);
            expect(tables).toHaveLength(55);
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
            expect(ledger).toHaveLength(24);
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
                  "SELECT id,hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id LIMIT 24",
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
      await writeFile(
        ".local/screening-safeguarding/migration-databases.json",
        JSON.stringify(databases),
        { mode: 0o600 },
      );
      await closeWorld(world);
    }
  }, 60000);
});
