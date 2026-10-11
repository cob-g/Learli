// Browser checks start from zero inventory. Isolated learli_test database only:
// createDatabase refuses any other target when its test flag is set.
import { createDatabase } from "../../src/lib/db/connection";

export default async function globalSetup() {
  const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
  try {
    await owner.pool.query("TRUNCATE TABLE tutor_profiles CASCADE");
    await owner.pool.query(
      "DELETE FROM subjects WHERE category = 'specialized'",
    );
    await owner.pool.query("UPDATE subjects SET is_active = true");
  } finally {
    await owner.pool.end();
  }
}
