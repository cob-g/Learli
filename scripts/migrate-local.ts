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
    GRANT SELECT ON learner_profiles, guardian_learner_links TO learli_app;
    GRANT SELECT, INSERT ON bookings TO learli_app;
    GRANT SELECT, INSERT ON booking_meeting_links, booking_meeting_link_events TO learli_app;
    GRANT UPDATE (provider, url, revision, request_id, updated_by_user_id, updated_at) ON booking_meeting_links TO learli_app;
    GRANT UPDATE (state) ON bookings TO learli_app;
    GRANT INSERT ON booking_events TO learli_app;
    GRANT SELECT (id, booking_id, event, created_at) ON booking_events TO learli_app;
    GRANT SELECT ON booking_notification_deliveries TO learli_app;
    GRANT UPDATE (state, attempts, last_attempt_at, closed_at, failure_code, suppressed_reason) ON booking_notification_deliveries TO learli_app;
    GRANT UPDATE (display_name, level, timezone, updated_at) ON learner_profiles TO learli_app;
    GRANT SELECT ON user_roles TO learli_app;
    GRANT SELECT ON support_reviewers, support_case_assignments TO learli_app;
    GRANT SELECT, INSERT ON support_cases, support_case_events TO learli_app;
    GRANT SELECT, INSERT ON support_case_bookings TO learli_app;
    GRANT INSERT ON support_booking_access_events TO learli_app;
    GRANT UPDATE (status, revision, updated_at) ON support_cases TO learli_app;
    GRANT SELECT, INSERT ON user_access TO learli_app;
    GRANT INSERT ON audit_events TO learli_app;
    GRANT SELECT, INSERT ON subjects TO learli_app;
    GRANT UPDATE (name, is_active, updated_at) ON subjects TO learli_app;
    GRANT SELECT, INSERT, UPDATE ON tutor_profiles TO learli_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON tutor_subjects, tutor_availability TO learli_app;
    GRANT SELECT, INSERT, DELETE ON tutor_availability_exceptions TO learli_app;
    GRANT SELECT, INSERT, DELETE ON tutor_teaching_languages TO learli_app;
    GRANT EXECUTE ON FUNCTION grant_tutor_role(text) TO learli_app;
    GRANT SELECT ON account_restriction_targets, account_restriction_grants, account_restriction_events TO learli_app;
    GRANT EXECUTE ON FUNCTION public.change_local_account_access(text,text,text,integer,text,text,uuid) TO learli_app;
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
