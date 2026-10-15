import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Database } from "@/lib/db/connection";
import { PgDialect } from "drizzle-orm/pg-core";
import { queryParticipantBookings } from "@/features/bookings/read-query";
import * as schema from "@/lib/db/schema";
import { openWorld, closeWorld, type World } from "./support";

let world: World;
beforeAll(() => {
  world = openWorld();
});
afterAll(() => closeWorld(world));
type PlanNode = { Alias?: string; "Actual Loops"?: number; Plans?: PlanNode[] };
function allNodes(node: PlanNode): PlanNode[] {
  return [node, ...(node.Plans ?? []).flatMap(allNodes)];
}

it("bounds logical-head projection by selected overview rows while keeping global expiry and detail history", async () => {
  const connection = await world.owner.pool.connect();
  await connection.query("BEGIN ISOLATION LEVEL READ COMMITTED");
  try {
    const actor = { userId: randomUUID(), sessionId: randomUUID() };
    const tutorUser = randomUUID(),
      tutorId = randomUUID(),
      learnerId = randomUUID();
    for (const [id, role] of [
      [actor.userId, "parent"],
      [tutorUser, "tutor"],
    ]) {
      await connection.query(
        `INSERT INTO "user"(id,name,email,email_verified) VALUES($1,'Synthetic projection test',$2,true)`,
        [id, `${id}@learli.test`],
      );
      await connection.query(
        "INSERT INTO user_access(user_id,status) VALUES($1,'active')",
        [id],
      );
      await connection.query(
        "INSERT INTO user_roles(user_id,role) VALUES($1,$2)",
        [id, role],
      );
    }
    await connection.query(
      "INSERT INTO session(id,user_id,token,expires_at,updated_at) VALUES($1,$2,$3,now()+interval '1 day',now())",
      [actor.sessionId, actor.userId, randomUUID()],
    );
    await connection.query(
      "INSERT INTO learner_profiles(id,fixture_key,source,management,display_name,level,timezone) VALUES($1,$2,'local_fixture','guardian','Synthetic projection learner','elementary','UTC')",
      [learnerId, randomUUID()],
    );
    await connection.query(
      "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,status,source) VALUES($1,$2,'authorized','local_fixture')",
      [actor.userId, learnerId],
    );
    await connection.query(
      "INSERT INTO tutor_profiles(id,user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,$3,'Synthetic projection test','Synthetic only','Synthetic only','UTC','approved')",
      [tutorId, tutorUser, `projection-${tutorId}`],
    );
    const subjectId = (
      await connection.query("SELECT id FROM subjects WHERE slug='math'")
    ).rows[0].id as string;
    const ids = [tutorId, learnerId, actor.userId, subjectId];
    // Earliest expiry belongs to the final active row, outside the 21-row page.
    await connection.query(
      `INSERT INTO bookings(source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at)
      SELECT 'local_simulation',$1,$2,$3,$4,now()+interval '30 days'+i*interval '2 hours',now()+interval '30 days'+i*interval '2 hours'+interval '1 hour','UTC',gen_random_uuid(),repeat('a',64),'demo_reserved',now(),now()+interval '1 hour'+(24-i)*interval '1 minute' FROM generate_series(1,24)i`,
      ids,
    );
    await connection.query(
      `INSERT INTO bookings(source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at)
      SELECT 'local_simulation',$1,$2,$3,$4,now()-interval '2 days'-i*interval '2 hours',now()-interval '2 days'-i*interval '2 hours'+interval '1 hour','UTC',gen_random_uuid(),repeat('a',64),'demo_expired',now()-interval '4 days',now()-interval '3 days' FROM generate_series(1,100)i`,
      ids,
    );
    const expectedExpiry = (
      await connection.query(
        "SELECT min(expires_at) AS expiry FROM bookings WHERE tutor_id=$1 AND state='demo_reserved'",
        [tutorId],
      )
    ).rows[0].expiry as Date;
    const expectedHistory = (
      await connection.query(
        "SELECT id FROM bookings WHERE tutor_id=$1 AND state='demo_expired' ORDER BY start_at_utc DESC,id DESC LIMIT 21",
        [tutorId],
      )
    ).rows.map((r: { id: string }) => r.id);
    await connection.query("SET LOCAL ROLE learli_app");
    // The reader only uses execute. Bind it to this rollback-only client; its
    // production Database type also carries an unused Pool-specific $client.
    const db = drizzle(connection, { schema }) as unknown as Database;
    const execute = vi.spyOn(db, "execute");
    const input = {
      scope: "guardian",
      filter: "all",
      page: 1,
      pageSize: 20,
    } as const;
    const overview = await queryParticipantBookings(
      db,
      actor,
      input,
      undefined,
      true,
    );
    expect(execute).toHaveBeenCalledTimes(1);
    const statement = execute.mock.calls[0][0];
    if (typeof statement === "string") throw new Error("Expected typed SQL.");
    const query = new PgDialect().sqlToQuery(statement.getSQL());
    execute.mockRestore();
    expect(overview?.activeItems).toHaveLength(21);
    expect(overview?.historyItems.map((item) => item.id)).toEqual(
      expectedHistory,
    );
    expect(new Date(overview!.earliestExpiry!).toISOString()).toBe(
      expectedExpiry.toISOString(),
    );
    expect(
      overview?.activeItems.some(
        (item) => new Date(item.expires).getTime() === expectedExpiry.getTime(),
      ),
    ).toBe(false);
    const plan = (
      await connection.query(
        `EXPLAIN (ANALYZE, FORMAT JSON) ${query.sql}`,
        query.params,
      )
    ).rows[0]["QUERY PLAN"][0].Plan as PlanNode;
    // The real correlated lookup runs once per selected item, never once per retained booking.
    const headScans = allNodes(plan).filter((node) =>
      /^head(?:_\d+)?$/.test(node.Alias ?? ""),
    );
    expect(headScans.length).toBeGreaterThan(0);
    expect(
      headScans.reduce((sum, node) => sum + (node["Actual Loops"] ?? 0), 0),
    ).toBe(42);
    const empty = await queryParticipantBookings(
      db,
      actor,
      { ...input, page: 10000 },
      undefined,
      true,
    );
    expect(empty?.historyItems).toEqual([]);
    expect(empty?.activeItems).toHaveLength(21);
    expect(new Date(empty!.earliestExpiry!).toISOString()).toBe(
      expectedExpiry.toISOString(),
    );
    const id = overview!.historyItems[0].id;
    const detail = await queryParticipantBookings(
      db,
      actor,
      { ...input, pageSize: 1 },
      id,
    );
    expect(detail?.items[0]).toEqual(overview!.historyItems[0]);
    await connection.query("RESET ROLE");
    await connection.query(
      "INSERT INTO booking_events(booking_id,event) VALUES($1,'demo_reserved')",
      [id],
    );
    await connection.query("SET LOCAL ROLE learli_app");
    const withHistory = await queryParticipantBookings(
      db,
      actor,
      { ...input, pageSize: 1 },
      id,
    );
    expect(withHistory?.items[0].events.map((event) => event.event)).toEqual([
      "demo_reserved",
    ]);
    expect(
      await queryParticipantBookings(
        db,
        { ...actor, sessionId: randomUUID() },
        input,
        undefined,
        true,
      ),
    ).toBeUndefined();
  } finally {
    await connection.query("ROLLBACK");
    connection.release();
  }
});
