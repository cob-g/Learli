// Explicit trusted fixture CLI; no capability/assignment endpoint exists.
import { readFileSync } from "node:fs";
import { z } from "zod";
import { createDatabase } from "../src/lib/db/connection";
import { parseServerEnv } from "../src/lib/env/schema";
import {
  authorizeFixtureReviewer,
  assignFixtureCase,
  revokeFixtureReviewer,
} from "../src/features/support/fixture-tooling";

process.loadEnvFile(".env.local");
const env = parseServerEnv(process.env);
if (env.APP_ENV !== "development" || env.AUTH_MODE !== "local")
  throw new Error("Support tooling is local-development only.");
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "");
try {
  if (owner.pool.options.database !== "learli_dev") throw new Error();
  const [action, label, caseId, ...extra] = process.argv.slice(2);
  if (
    extra.length ||
    !["authorize", "assign", "revoke"].includes(action) ||
    !label ||
    (action === "assign" ? !caseId : !!caseId)
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
  const fixture = manifest.find(
    (entry) =>
      entry.email === `${label}@fixtures.learli.test` &&
      entry.roles.includes("admin"),
  );
  if (!fixture) throw new Error();
  const [account] = await owner.pool
    .query('SELECT id FROM "user" WHERE id = $1 AND email = $2', [
      fixture.userId,
      fixture.email,
    ])
    .then((r) => r.rows);
  if (!account) throw new Error();
  if (action === "authorize")
    await authorizeFixtureReviewer(owner, fixture.userId);
  else if (action === "revoke")
    await revokeFixtureReviewer(owner, fixture.userId);
  else await assignFixtureCase(owner, caseId, fixture.userId);
  console.log(
    "Local support fixture operation complete. Case text and credentials omitted.",
  );
} catch {
  console.error(
    "Support tooling stopped safely. Use authorize|revoke <admin-fixture-label> or assign <admin-fixture-label> <case-uuid>; only owned synthetic admin fixtures are accepted.",
  );
  process.exitCode = 1;
} finally {
  await owner.pool.end();
}
