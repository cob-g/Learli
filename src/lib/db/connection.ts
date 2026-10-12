// Node-only implementation, also used by local migration/fixture/test tooling.
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { localDatabaseConfig } from "./local-config";
import * as schema from "./schema";
import { emitDiagnostic } from "../diagnostics.server";

export function createDatabase(url: string, testOnly = false) {
  let pool: Pool;
  try {
    pool = new Pool(localDatabaseConfig(url, testOnly));
  } catch (error) {
    emitDiagnostic("database.setup_failed");
    throw error;
  }
  pool.on("error", () => {
    emitDiagnostic("database.pool_failed");
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
export type Database = ReturnType<typeof createDatabase>["db"];
