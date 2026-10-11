import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "../src/lib/db/connection";

const testing = process.argv.includes("--test");
process.loadEnvFile(testing ? ".env.test.local" : ".env.local");
const runtime = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", testing);
try {
  await migrate(runtime.db, { migrationsFolder: "drizzle" });
  // Runtime cannot change schema, role grants, account status, or audit history.
  await runtime.pool.query(`
    REVOKE ALL ON SCHEMA public FROM PUBLIC;
    GRANT USAGE ON SCHEMA public TO learli_app;
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM learli_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "user", "session", "account", "verification", "rate_limit" TO learli_app;
    GRANT SELECT ON user_roles TO learli_app;
    GRANT SELECT, INSERT ON user_access TO learli_app;
    GRANT INSERT ON audit_events TO learli_app;
    GRANT SELECT, INSERT, UPDATE ON subjects, tutor_profiles TO learli_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON tutor_subjects TO learli_app;
    GRANT EXECUTE ON FUNCTION grant_tutor_role(text) TO learli_app;
  `);
  console.log(
    `Reviewed migrations applied to local ${testing ? "test" : "development"} database. Runtime grants restricted.`,
  );
} catch {
  console.error(
    "Local migration failed; details omitted. Existing data was not reset.",
  );
  process.exitCode = 1;
} finally {
  await runtime.pool.end();
}
