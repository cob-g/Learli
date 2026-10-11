// Owned synthetic records only; callers supply the isolated test owner pool.
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

export async function familyLearner(
  pool: Pool,
  actorId: string,
  management: "guardian" | "self",
  displayName: string,
) {
  const result = await pool.query(
    "INSERT INTO learner_profiles(fixture_key,source,management,user_id,display_name,level,timezone) VALUES ($1,'local_fixture',$2,$3,$4,$5,'Asia/Manila') RETURNING id",
    [
      randomUUID(),
      management,
      management === "self" ? actorId : null,
      displayName,
      management === "self" ? "college_support" : "elementary",
    ],
  );
  const id = result.rows[0].id as string;
  if (management === "guardian")
    await pool.query(
      "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES ($1,$2,'local_fixture','authorized')",
      [actorId, id],
    );
  return id;
}

export async function familyTutor(pool: Pool) {
  const id = randomUUID();
  await pool.query(
    'INSERT INTO "user"(id,name,email,email_verified) VALUES ($1,$2,$3,true)',
    [
      id,
      "Synthetic Zoë Müller-Castañeda Tutor With A Long Display Name",
      `family-tutor-${id}@learli.test`,
    ],
  );
  await pool.query("INSERT INTO user_access(user_id) VALUES ($1)", [id]);
  await pool.query("INSERT INTO user_roles(user_id,role) VALUES ($1,'tutor')", [
    id,
  ]);
  const profile = await pool.query(
    "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES ($1,$2,'Synthetic support','Synthetic fixture only.','Synthetic fixture only.','Asia/Manila','approved') RETURNING id",
    [id, `family-${id}`],
  );
  return profile.rows[0].id as string;
}

export async function familyReservation(
  pool: Pool,
  options: {
    learnerId: string;
    actorId: string;
    tutorId: string;
    expired?: boolean;
    startMinutes?: number;
    expiresInSeconds?: number;
  },
) {
  const id = randomUUID();
  // Direct owner fixture insertion exercises reads without changing domain APIs.
  await pool.query(
    "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) SELECT $1,'local_simulation',$2,$3,$4,id,now()+($5::int * interval '1 minute'),now()+(($5::int+60) * interval '1 minute'),'Asia/Manila',$6,repeat('a',64),'demo_reserved',now()+($7::int * interval '1 second'),now()+($8::int * interval '1 second') FROM subjects WHERE slug='math'",
    [
      id,
      options.tutorId,
      options.learnerId,
      options.actorId,
      options.startMinutes ?? 180,
      randomUUID(),
      options.expiresInSeconds !== undefined
        ? options.expiresInSeconds - 600
        : options.expired
          ? -1200
          : 0,
      options.expiresInSeconds ?? (options.expired ? -600 : 600),
    ],
  );
  await pool.query(
    "INSERT INTO booking_events(booking_id,event,created_at) SELECT id,'demo_reserved',created_at FROM bookings WHERE id=$1",
    [id],
  );
  return id;
}
