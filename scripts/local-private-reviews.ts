// Explicit owned local fixture CLI. No role grant or runtime completion route.
import { readFileSync } from "node:fs";
import { z } from "zod";
import { createDatabase } from "../src/lib/db/connection";
import { parseServerEnv } from "../src/lib/env/schema";
import {
  provisionReviewModerator,
  provisionReviewGrant,
  prepareHistoricalReviewFixture,
  requireReviewOwner,
} from "../src/features/private-reviews/fixture-tooling";
import { completeHistoricalDemoFixture } from "../src/features/bookings/fixture-tooling";
process.loadEnvFile(".env.local");
const env = parseServerEnv(process.env);
if (env.APP_ENV !== "development" || env.AUTH_MODE !== "local")
  throw new Error("Local development tooling only.");
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "");
try {
  await requireReviewOwner(owner);
  if (owner.pool.options.database !== "learli_dev") throw new Error();
  const [action, ...args] = process.argv.slice(2);
  if (action === "prepare-history") {
    if (args.length !== 7) throw new Error();
    const [
      familyLabel,
      tutorLabel,
      learnerId,
      subjectSlug,
      start,
      end,
      requestId,
    ] = args;
    const result = await prepareHistoricalReviewFixture(owner, {
      familyLabel,
      tutorLabel,
      learnerId,
      subjectSlug,
      start,
      end,
      requestId,
    });
    console.log(
      `${result.completed ? "Historical synthetic fixture completed" : "Preparation saved; completion uncertain. Repeat identical command to retry"}: ${env.APP_URL}/bookings/${result.id}/review`,
    );
    if (!result.completed) process.exitCode = 1;
  } else if (action === "complete-ended") {
    if (args.length !== 1) throw new Error();
    const owned = z
      .array(z.object({ email: z.string(), userId: z.string() }))
      .parse(JSON.parse(readFileSync(".local/fixtures.json", "utf8")));
    const row = await owner.pool.query(
      'SELECT b.booked_by_user_id AS family,tp.user_id AS tutor,u.email AS family_email,tu.email AS tutor_email FROM bookings b JOIN tutor_profiles tp ON tp.id=b.tutor_id JOIN "user" u ON u.id=b.booked_by_user_id JOIN "user" tu ON tu.id=tp.user_id WHERE b.id=$1',
      [z.uuid().parse(args[0])],
    );
    if (
      !row.rowCount ||
      !owned.some(
        (e) =>
          e.userId === row.rows[0].family &&
          e.email === row.rows[0].family_email,
      ) ||
      !owned.some(
        (e) =>
          e.userId === row.rows[0].tutor && e.email === row.rows[0].tutor_email,
      )
    )
      throw new Error();
    await completeHistoricalDemoFixture(owner, z.uuid().parse(args[0]));
    console.log(
      "Ended synthetic fixture completion recorded; no attendance claim.",
    );
  } else {
    if (
      !["authorize", "revoke", "grant", "revoke-grant"].includes(action) ||
      args.length !== (["grant", "revoke-grant"].includes(action) ? 2 : 1)
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
      (e) =>
        e.email === `${args[0]}@fixtures.learli.test` &&
        e.roles.includes("admin"),
    );
    if (!fixture) throw new Error();
    const exact = await owner.pool.query(
      'SELECT id FROM "user" WHERE id=$1 AND email=$2',
      [fixture.userId, fixture.email],
    );
    if (!exact.rowCount) throw new Error();
    if (action === "authorize" || action === "revoke")
      await provisionReviewModerator(
        owner,
        fixture.userId,
        action === "authorize" ? "authorized" : "revoked",
      );
    else
      await provisionReviewGrant(
        owner,
        fixture.userId,
        args[1],
        action === "grant" ? "authorized" : "revoked",
      );
    console.log(
      "Private synthetic moderator operation saved. Review text and identities omitted.",
    );
  }
} catch {
  console.error(
    "Local review tooling stopped safely. Use prepare-history <family-label> <tutor-label> <learner-uuid> <subject-slug> <past-start-ISO> <past-end-ISO> <stable-request-uuid>, complete-ended <booking-uuid>, authorize|revoke <admin-label>, or grant|revoke-grant <admin-label> <review-uuid>. Exact owned synthetic fixtures required; existing records preserved.",
  );
  process.exitCode = 1;
} finally {
  await owner.pool.end();
}
