// Node-only implementation, also used by local migration/fixture/test tooling.
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { localDatabaseConfig } from "./local-config";
import * as schema from "./schema";

export function createDatabase(url: string, testOnly = false) {
  const pool = new Pool(localDatabaseConfig(url, testOnly));
  pool.on("error", () => {
    console.error("Local database connection failed; details omitted.");
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
export type Database = ReturnType<typeof createDatabase>["db"];
