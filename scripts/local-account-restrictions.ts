import { readFileSync } from "node:fs";
import { z } from "zod";
import { createDatabase } from "../src/lib/db/connection";
import { parseServerEnv } from "../src/lib/env/schema";
import {
  provisionRestrictionTarget,
  authorizeRestrictionTarget,
  revokeRestrictionTarget,
} from "../src/features/account-restrictions/fixture-tooling";
process.loadEnvFile(".env.local");
const env = parseServerEnv(process.env);
if (env.APP_ENV !== "development" || env.AUTH_MODE !== "local")
  throw new Error("Local development fixture tooling only.");
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "");
try {
  if (owner.pool.options.database !== "learli_dev") throw new Error();
  const [action, staffLabel, targetLabel, ...extra] = process.argv.slice(2);
  if (
    extra.length ||
    !["authorize", "revoke"].includes(action) ||
    !staffLabel ||
    !targetLabel
  )
    throw new Error();
  const manifest = z
    .array(
      z.object({
        email: z.string(),
        userId: z.string(),
        roles: z.array(z.string()),
      }),
    )
    .parse(JSON.parse(readFileSync(".local/fixtures.json", "utf8")));
  const staff = manifest.find(
    (f) =>
      f.email === `${staffLabel}@fixtures.learli.test` &&
      f.roles.includes("admin"),
  );
  const target = manifest.find(
    (f) =>
      f.email === `${targetLabel}@fixtures.learli.test` &&
      !f.roles.includes("admin"),
  );
  if (!staff || !target || staff.userId === target.userId) throw new Error();
  for (const entry of [staff, target]) {
    const r = await owner.pool.query(
      'SELECT 1 FROM "user" WHERE id=$1 AND email=$2',
      [entry.userId, entry.email],
    );
    if (!r.rowCount) throw new Error();
  }
  if (action === "authorize") {
    await provisionRestrictionTarget(owner, target.userId);
    await authorizeRestrictionTarget(owner, staff.userId, target.userId);
  } else await revokeRestrictionTarget(owner, staff.userId, target.userId);
  console.log(
    "Exact local fixture authority operation completed. Credentials omitted.",
  );
} catch {
  console.error(
    "Fixture authority stopped safely. Use authorize|revoke <admin-fixture-label> <non-admin-fixture-label>; revoked grants remain revoked.",
  );
  process.exitCode = 1;
} finally {
  await owner.pool.end();
}
