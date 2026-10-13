import { writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createStagingTlsHarness } from "./staging-tls";
import { runtimeGrantsSql } from "../../scripts/runtime-grants";
import { verifyRuntimeGrants } from "../../scripts/staging-migrations/privileges";
import * as schema from "../../src/lib/db/schema";

export async function createHostedAuthDatabase() {
  if (process.env.APP_ENV !== "test" || !process.env.LEARLI_STAGING_TEST_PORT)
    throw new Error(
      "Hosted tests require an assigned TLS port and test environment.",
    );
  const harness = await createStagingTlsHarness();
  const owner = new Pool({
    ...harness.settings("learli_migrator"),
    options: "-c search_path=public,pg_catalog",
  });
  let phase = "migrate";
  try {
    await migrate(drizzle(owner, { schema }), { migrationsFolder: "drizzle" });
    phase = "grants";
    await owner.query(runtimeGrantsSql);
    phase = "inspect";
    const inspector = await owner.connect();
    try {
      await verifyRuntimeGrants(inspector);
    } finally {
      inspector.release();
    }
    return {
      harness,
      owner,
      async close() {
        await owner.end();
        harness.stop();
      },
    };
  } catch (error) {
    const code =
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string" &&
      /^[a-zA-Z0-9_]{1,40}$/.test(error.code)
        ? error.code
        : "omitted";
    writeFileSync(
      path.join(harness.directory, "setup-failure.json"),
      JSON.stringify({ phase, code }),
      { mode: 0o600 },
    );
    await owner.end();
    harness.stop();
    throw new Error(
      "Owned hosted auth database setup failed. Private evidence retained.",
    );
  }
}
/** Owner-only identity grant in a disposable synthetic database; never application authority. */
export async function grantHostedTestAdmin(owner: Pool, email: string) {
  if (!email.endsWith("@example.test"))
    throw new Error("Synthetic fixture only.");
  const result = await owner.query<{ id: string }>(
    'SELECT id FROM public."user" WHERE email=$1',
    [email],
  );
  if (!result.rows[0]) throw new Error("Synthetic identity missing.");
  await owner.query(
    "INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin') ON CONFLICT DO NOTHING",
    [result.rows[0].id],
  );
  return result.rows[0].id;
}
export const hostedSyntheticPassword = () => `W3-${randomUUID()}-test-only`;
