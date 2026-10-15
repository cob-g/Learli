import { runtimeGrantsSql } from "./runtime-grants";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "../src/lib/db/connection";

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--test")) {
  console.error("Usage: tsx scripts/migrate-local.ts [--test]");
  process.exitCode = 1;
} else {
  const testing = args[0] === "--test";
  process.loadEnvFile(testing ? ".env.test.local" : ".env.local");
  const runtime = createDatabase(
    process.env.DATABASE_URL_DIRECT ?? "",
    testing,
  );
  try {
    await migrate(runtime.db, { migrationsFolder: "drizzle" });
    await runtime.pool.query(runtimeGrantsSql);
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
}
