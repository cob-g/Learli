// Node-only, internal query. Never import from browser code or consumer features.
import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/connection";
import type { BookingListInput } from "./read-input";
import type { StoredBookingRead } from "./read-projection";
import type { BookingLearnerSummary } from "./read-model";

type ReadActor = { userId: string; sessionId: string };
export type ReadSnapshot = {
  timezone: string;
  snapshot: string;
  items: StoredBookingRead[];
  learners: BookingLearnerSummary[];
  activeItems: StoredBookingRead[];
  historyItems: StoredBookingRead[];
};

/**
 * A single READ COMMITTED statement is the authorization point. No row locks or
 * writes: a waited provider/earlier query can never supply stale grants here.
 * Expiry projection and persisted history use the same DB statement clock.
 */
export async function queryParticipantBookings(
  db: Database,
  actor: ReadActor,
  input: BookingListInput,
  bookingId?: string,
  overview = false,
): Promise<ReadSnapshot | undefined> {
  const role = input.scope === "guardian" ? "parent" : input.scope;
  const relation =
    input.scope === "tutor"
      ? sql`tp.user_id = a.id AND tp.review_status <> 'suspended'`
      : input.scope === "student"
        ? sql`l.management = 'self' AND l.user_id = a.id AND l.level = 'college_support'`
        : sql`l.management = 'guardian' AND l.user_id IS NULL AND EXISTS (
            SELECT 1 FROM guardian_learner_links g
            WHERE g.guardian_user_id = a.id AND g.learner_id = l.id
              AND g.status = 'authorized' AND g.source = 'local_fixture')`;
  const active = sql`b.state = 'demo_reserved' AND b.expires_at > a.now AND b.end_at_utc > a.now`;
  const filter =
    input.filter === "active"
      ? active
      : input.filter === "history"
        ? sql`NOT (${active})`
        : sql`TRUE`;
  const order = input.filter === "active" ? sql`ASC` : sql`DESC`;
  const result = await db.execute<ReadSnapshot>(sql`
    WITH actor AS (
      SELECT u.id, u.timezone, statement_timestamp() AS now
      FROM "user" u
      JOIN user_access ua ON ua.user_id = u.id AND ua.status = 'active'
      JOIN session s ON s.user_id = u.id AND s.id = ${actor.sessionId}
        AND s.expires_at > statement_timestamp()
      WHERE u.id = ${actor.userId} AND u.email_verified = true
        AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$'
        AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = ${role})
        ${input.scope === "tutor" ? sql`AND EXISTS (SELECT 1 FROM tutor_profiles own WHERE own.user_id = u.id AND own.review_status <> 'suspended')` : sql``}
    ), permitted AS (
      SELECT b.id, b.start_at_utc, ${active} AS active,
        jsonb_build_object(
          'id', b.id, 'tutorName', tu.name, 'tutorSlug', tp.slug,
          'subjectName', sub.name, 'subjectSlug', sub.slug,
          'learnerId', l.id, 'learnerName', l.display_name, 'learnerLevel', l.level,
          'state', b.state, 'start', b.start_at_utc, 'end', b.end_at_utc,
          'expires', b.expires_at, 'events', ${bookingId ? sql`COALESCE((SELECT jsonb_agg(jsonb_build_object('id', e.id, 'event', e.event, 'at', e.created_at) ORDER BY e.created_at ASC, e.id ASC) FROM booking_events e WHERE e.booking_id = b.id), '[]'::jsonb)` : sql`'[]'::jsonb`}
        ) AS item
      FROM actor a JOIN bookings b ON b.source = 'local_simulation'
      JOIN learner_profiles l ON l.id = b.learner_id
        AND l.status = 'active' AND l.source = 'local_fixture'
      JOIN tutor_profiles tp ON tp.id = b.tutor_id
      JOIN "user" tu ON tu.id = tp.user_id
      JOIN subjects sub ON sub.id = b.subject_id
      WHERE ${relation} AND ${filter}
        ${bookingId ? sql`AND b.id = ${bookingId}::uuid` : sql``}
        ${input.learnerId ? sql`AND l.id = ${input.learnerId}::uuid` : sql``}
    ), paged AS (
      SELECT * FROM permitted ORDER BY start_at_utc ${order}, id ${order}
      LIMIT ${bookingId ? 1 : input.pageSize + 1} OFFSET ${bookingId ? 0 : (input.page - 1) * input.pageSize}
    ), active_paged AS (
      SELECT * FROM permitted WHERE active ORDER BY start_at_utc ASC, id ASC
      LIMIT ${input.pageSize + 1}
    ), history_paged AS (
      SELECT * FROM permitted WHERE NOT active ORDER BY start_at_utc DESC, id DESC
      LIMIT ${input.pageSize + 1} OFFSET ${(input.page - 1) * input.pageSize}
    )
    SELECT a.timezone, a.now::text AS snapshot,
      ${overview ? sql`'[]'::jsonb` : sql`COALESCE((SELECT jsonb_agg(item ORDER BY start_at_utc ${order}, id ${order}) FROM paged), '[]'::jsonb)`} AS items,
      ${overview ? sql`COALESCE((SELECT jsonb_agg(item ORDER BY start_at_utc ASC, id ASC) FROM active_paged), '[]'::jsonb)` : sql`'[]'::jsonb`} AS "activeItems",
      ${overview ? sql`COALESCE((SELECT jsonb_agg(item ORDER BY start_at_utc DESC, id DESC) FROM history_paged), '[]'::jsonb)` : sql`'[]'::jsonb`} AS "historyItems",
      ${
        input.scope === "tutor"
          ? sql`'[]'::jsonb`
          : sql`COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', lp.id, 'displayName', lp.display_name, 'level', lp.level) ORDER BY lp.created_at ASC, lp.id ASC)
        FROM learner_profiles lp WHERE lp.status = 'active' AND lp.source = 'local_fixture'
          AND ${input.scope === "student" ? sql`lp.management = 'self' AND lp.user_id = a.id AND lp.level = 'college_support'` : sql`lp.management = 'guardian' AND lp.user_id IS NULL AND EXISTS (SELECT 1 FROM guardian_learner_links gl WHERE gl.learner_id = lp.id AND gl.guardian_user_id = a.id AND gl.status = 'authorized' AND gl.source = 'local_fixture')`}
      ), '[]'::jsonb)`
      } AS learners
    FROM actor a
  `);
  return result.rows[0];
}
