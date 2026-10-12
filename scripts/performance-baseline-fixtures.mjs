import { randomUUID, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  BaselineError,
  fixtureEmail,
  workload,
} from "./performance-baseline-core.mjs";

export async function assertEmptyDataset(pool) {
  const result = await pool.query(`SELECT
    (SELECT count(*)::int FROM "user") AS users,
    (SELECT count(*)::int FROM tutor_profiles) AS tutors,
    (SELECT count(*)::int FROM learner_profiles) AS learners,
    (SELECT count(*)::int FROM bookings) AS bookings`);
  if (Object.values(result.rows[0]).some((count) => count !== 0))
    throw new BaselineError(
      "Performance fixture setup requires empty owned test data.",
    );
  const subject = await pool.query(
    "SELECT id FROM subjects WHERE slug='math' AND is_active",
  );
  if (subject.rowCount !== 1)
    throw new BaselineError("Migrated active Math catalog required.");
  return subject.rows[0].id;
}

export function fixtureRegistry(file) {
  const run = randomUUID();
  const registry = {
    run,
    users: [],
    emails: [],
    learners: [],
    tutors: [],
    cleanup: "pending",
  };
  const save = () =>
    writeFileSync(file, JSON.stringify(registry, null, 2), { mode: 0o600 });
  save();
  return { registry, save, contexts: [] };
}

export async function createFixtures(pool, request, origin, record) {
  const subjectId = await assertEmptyDataset(pool);
  const { registry, save } = record;
  const actors = [];
  for (let index = 0; index < 2; index++) {
    const email = fixtureEmail(registry.run, "learner", index);
    registry.emails.push(email);
    save();
    const context = await request.newContext({
      baseURL: origin,
      timeout: 30_000,
    });
    record.contexts.push(context);
    const password = randomBytes(32).toString("hex");
    const signup = await context.post("/api/auth/sign-up/email", {
      headers: { origin },
      data: { email, password, name: "Synthetic performance learner" },
    });
    if (signup.status() !== 200) {
      throw new BaselineError(
        `Synthetic signup failed (HTTP ${signup.status()}).`,
      );
    }
    const userId = (await signup.json()).user.id;
    registry.users.push(userId);
    save();
    await pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
      userId,
    ]);
    await pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES ($1,'student')",
      [userId],
    );
    const learnerId = randomUUID();
    registry.learners.push(learnerId);
    save();
    await pool.query(
      "INSERT INTO learner_profiles(id,fixture_key,source,management,user_id,display_name,level,timezone) VALUES ($1,$2,'local_fixture','self',$3,'Synthetic performance learner','college_support','UTC')",
      [learnerId, randomUUID(), userId],
    );
    const signin = await context.post("/api/auth/sign-in/email", {
      headers: { origin },
      data: { email, password },
    });
    if (signin.status() !== 200) {
      throw new BaselineError(
        `Synthetic sign-in failed (HTTP ${signin.status()}).`,
      );
    }
    actors.push({ context, learnerId });
  }
  const tutors = [];
  for (let index = 0; index < workload.tutors; index++) {
    const userId = randomUUID(),
      profileId = randomUUID();
    const slug = `performance-${registry.run}-${index}`;
    const timezone = ["UTC", "Asia/Manila", "America/New_York"][index % 3];
    registry.users.push(userId);
    registry.tutors.push(profileId);
    save();
    await pool.query(
      'INSERT INTO "user"(id,name,email,email_verified) VALUES ($1,$2,$3,true)',
      [
        userId,
        `Synthetic performance tutor ${String(index).padStart(2, "0")}`,
        fixtureEmail(registry.run, "tutor", index),
      ],
    );
    await pool.query("INSERT INTO user_access(user_id) VALUES ($1)", [userId]);
    await pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES ($1,'tutor')",
      [userId],
    );
    await pool.query(
      "INSERT INTO tutor_profiles(id,user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES ($1,$2,$3,'Synthetic Math support','Synthetic local performance fixture.','Synthetic fixture only.',$4,'approved')",
      [profileId, userId, slug, timezone],
    );
    await pool.query(
      "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) VALUES ($1,$2,ARRAY['college_support','high_school'])",
      [profileId, subjectId],
    );
    await pool.query(
      "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) SELECT $1,day,1080,1200 FROM generate_series(1,7) day",
      [profileId],
    );
    await pool.query(
      "INSERT INTO tutor_availability_exceptions(tutor_id,start_at_utc,end_at_utc) VALUES ($1,date_trunc('day',now())+interval '2 days 18 hours',date_trunc('day',now())+interval '2 days 19 hours')",
      [profileId],
    );
    tutors.push({ profileId, slug });
  }
  return { actors, tutors };
}

export async function cleanupFixtures(pool, record) {
  const { registry, save } = record;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Exact owned tutor IDs include reservations even if an HTTP response was lost.
    await client.query(
      "DELETE FROM booking_notification_deliveries WHERE event_id IN (SELECT e.id FROM booking_events e JOIN bookings b ON b.id=e.booking_id WHERE b.tutor_id=ANY($1::uuid[]))",
      [registry.tutors],
    );
    await client.query(
      "DELETE FROM booking_events WHERE booking_id IN (SELECT id FROM bookings WHERE tutor_id=ANY($1::uuid[]))",
      [registry.tutors],
    );
    await client.query("DELETE FROM bookings WHERE tutor_id=ANY($1::uuid[])", [
      registry.tutors,
    ]);
    await client.query("DELETE FROM tutor_profiles WHERE id=ANY($1::uuid[])", [
      registry.tutors,
    ]);
    await client.query(
      "DELETE FROM learner_profiles WHERE id=ANY($1::uuid[])",
      [registry.learners],
    );
    // Signup can commit before a lost response reveals its user ID.
    const ownedUsers = await client.query(
      'SELECT id FROM "user" WHERE id=ANY($1::text[]) OR email=ANY($2::text[])',
      [registry.users, registry.emails],
    );
    const ids = ownedUsers.rows.map((row) => row.id);
    await client.query(
      "DELETE FROM audit_events WHERE actor_user_id=ANY($1::text[]) OR target_user_id=ANY($1::text[])",
      [ids],
    );
    await client.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [ids]);
    await client.query("COMMIT");
    await assertEmptyDataset(client);
    registry.cleanup = "passed";
    save();
  } catch {
    await client.query("ROLLBACK");
    registry.cleanup = "failed";
    save();
    throw new BaselineError(
      "Owned fixture cleanup failed; private registry retained.",
    );
  } finally {
    client.release();
  }
}
