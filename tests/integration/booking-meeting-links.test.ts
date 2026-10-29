import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  readPrivateMeetingLink,
  savePrivateMeetingLink,
} from "@/features/booking-meeting-links/service";
import {
  handleMeetingEdit,
  handleMeetingRead,
} from "@/features/booking-meeting-links/handler";
import {
  readParticipantBooking,
  listParticipantBookings,
} from "@/features/bookings/read-service";
import {
  openWorld,
  closeWorld,
  createAccount,
  jsonRequest,
  type World,
  type TestAccount,
} from "./support";
let world: World,
  tutor: TestAccount,
  parent: TestAccount,
  other: TestAccount,
  admin: TestAccount,
  self: TestAccount;
let profileId: string, guardianId: string, selfId: string, subjectId: string;
let sequence = 0;
const url = "https://zoom.us/j/12345678901?pwd=syntheticPrivateValue";
const replacement = "https://meet.google.com/abc-defg-hij";
const input = (
  expectedRevision = 0,
  value = url,
  requestId = randomUUID(),
) => ({ url: value, expectedRevision, requestId });
async function booking({
  independent = false,
  remaining = 600000,
  state = "demo_reserved",
}: { independent?: boolean; remaining?: number; state?: string } = {}) {
  const id = randomUUID(),
    start = new Date(Date.now() + (++sequence + 20) * 86400000);
  await world.owner.pool.query(
    `INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) VALUES($1,'local_simulation',$2,$3,$4,$5,$6,$7,'UTC',$8,$9,$10,clock_timestamp()-interval '10 minutes'+$11*interval '1 millisecond',clock_timestamp()+$11*interval '1 millisecond')`,
    [
      id,
      profileId,
      independent ? selfId : guardianId,
      independent ? self.id : parent.id,
      subjectId,
      start,
      new Date(start.getTime() + 3600000),
      randomUUID(),
      "a".repeat(64),
      state,
      remaining,
    ],
  );
  return id;
}
const read = (actor: TestAccount, id: string) =>
  readPrivateMeetingLink(world.runtime, actor.headers, id);
const save = (actor: TestAccount, id: string, payload: unknown = input()) =>
  savePrivateMeetingLink(world.runtime, actor.headers, id, payload);
async function rejected(promise: Promise<unknown>, status = 404) {
  await expect(promise).rejects.toMatchObject({ status });
}
async function waitForLock() {
  for (let i = 0; i < 200; i++) {
    const r = await world.owner.pool.query(
      `SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND usename='learli_app' AND wait_event_type='Lock'`,
    );
    if (r.rowCount) return;
    await delay(10);
  }
  throw new Error("Expected exact owned runtime lock wait.");
}
beforeAll(async () => {
  world = openWorld();
  await world.owner.pool.query("UPDATE rate_limit SET count=0");
  tutor = await createAccount(world, ["tutor"]);
  parent = await createAccount(world, ["parent"]);
  other = await createAccount(world, ["parent", "tutor"]);
  admin = await createAccount(world, ["admin", "tutor", "parent", "student"]);
  self = await createAccount(world, ["student"]);
  subjectId = (
    await world.owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
  ).rows[0].id;
  profileId = (
    await world.owner.pool.query(
      `INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,'Synthetic tutor','Synthetic only','Fixture','UTC','approved') RETURNING id`,
      [tutor.id, `meet-${randomUUID()}`],
    )
  ).rows[0].id;
  for (const independent of [false, true]) {
    const r = await world.owner.pool.query(
      `INSERT INTO learner_profiles(fixture_key,source,management,user_id,display_name,level,timezone) VALUES($1,'local_fixture',$2,$3,'Synthetic meeting learner',$4,'UTC') RETURNING id`,
      [
        randomUUID(),
        independent ? "self" : "guardian",
        independent ? self.id : null,
        independent ? "college_support" : "elementary",
      ],
    );
    if (independent) selfId = r.rows[0].id;
    else guardianId = r.rows[0].id;
  }
  await world.owner.pool.query(
    "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
    [parent.id, guardianId],
  );
}, 60000);
afterAll(() => closeWorld(world));
describe("private links on real PostgreSQL reservations", () => {
  it("missing, eligible tutor save/replace and both guardian/self reads with isolated DTOs", async () => {
    const id = await booking();
    expect(await read(parent, id)).toEqual({
      state: "missing",
      canEdit: false,
      revision: 0,
    });
    expect(await save(tutor, id)).toEqual({ revision: 1 });
    expect(await read(tutor, id)).toMatchObject({
      state: "present",
      canEdit: true,
      url,
      revision: 1,
    });
    expect(await read(parent, id)).toMatchObject({
      state: "present",
      canEdit: false,
      url,
    });
    expect(
      JSON.stringify(
        await readParticipantBooking(
          world.runtime,
          parent.headers,
          id,
          "guardian",
        ),
      ),
    ).not.toContain(url);
    expect(
      JSON.stringify(
        await listParticipantBookings(world.runtime, parent.headers, {
          scope: "guardian",
          filter: "all",
        }),
      ),
    ).not.toContain(url);
    expect(await save(tutor, id, input(1, replacement))).toEqual({
      revision: 2,
    });
    expect(await read(parent, id)).toMatchObject({
      url: replacement,
      provider: "google_meet",
      revision: 2,
    });
    const independent = await booking({ independent: true });
    await save(tutor, independent);
    expect(await read(self, independent)).toMatchObject({ url });
    await rejected(read(self, id));
    await rejected(read(parent, independent));
  });
  it.each([
    "https://evil.test/j/12345678901",
    "https://zoom.us.evil.test/j/12345678901",
    "http://zoom.us/j/12345678901",
    "https://zoom.us/j/12345678901?pwd=a&other=b",
    "https://meet.google.com/abc-defg-hij#secret",
    "https://user@zoom.us/j/12345678901",
  ])("rejects malicious URL %s before writes", async (value) => {
    const id = await booking();
    await expect(save(tutor, id, input(0, value))).rejects.toMatchObject({
      name: "ZodError",
    });
    expect(await read(tutor, id)).toMatchObject({ state: "missing" });
  });
  it("wrong tutor, unrelated multi-role staff, guardian write and guessed IDs disclose nothing", async () => {
    const id = await booking();
    await save(tutor, id);
    for (const actor of [other, admin]) {
      await rejected(read(actor, id));
      await rejected(save(actor, id, input(1)));
    }
    await rejected(save(parent, id, input(1)));
    await rejected(read(parent, randomUUID()));
    await rejected(read(tutor, "bad"));
  });
  it("current role and guardian revocations deny read/open; restoring relationship keeps original URL", async () => {
    const id = await booking();
    await save(tutor, id);
    await world.owner.pool.query(
      "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1 AND learner_id=$2",
      [parent.id, guardianId],
    );
    await rejected(read(parent, id));
    const opened = await handleMeetingRead(
      world.runtime,
      jsonRequest(world, `/api/bookings/${id}/meeting-link?open=1`, {
        method: "GET",
        cookie: parent.cookie,
      }),
      id,
    );
    expect(opened.status).toBe(404);
    expect(opened.headers.get("location")).toBeNull();
    await world.owner.pool.query(
      "UPDATE guardian_learner_links SET status='authorized' WHERE guardian_user_id=$1 AND learner_id=$2",
      [parent.id, guardianId],
    );
    await world.owner.pool.query(
      "DELETE FROM user_roles WHERE user_id=$1 AND role='parent'",
      [parent.id],
    );
    await rejected(read(parent, id));
    await world.owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'parent')",
      [parent.id],
    );
    expect(await read(parent, id)).toMatchObject({ url });
  });
  it.each(["pending", "rejected", "suspended"])(
    "ineligible tutor state %s blocks all URL reads and edits",
    async (status) => {
      const id = await booking();
      await save(tutor, id);
      await world.owner.pool.query(
        "UPDATE tutor_profiles SET review_status=$2 WHERE id=$1",
        [profileId, status],
      );
      try {
        await rejected(read(parent, id));
        await rejected(read(tutor, id));
        await rejected(save(tutor, id, input(1)));
      } finally {
        await world.owner.pool.query(
          "UPDATE tutor_profiles SET review_status='approved' WHERE id=$1",
          [profileId],
        );
      }
    },
  );
  it.each([
    "actor_suspended",
    "tutor_suspended",
    "actor_unverified",
    "tutor_unverified",
    "learner_inactive",
    "tutor_role_removed",
  ])("fresh %s restriction hides URLs", async (kind) => {
    const id = await booking();
    await save(tutor, id);
    if (kind.endsWith("suspended"))
      await world.owner.pool.query(
        "UPDATE user_access SET status='suspended' WHERE user_id=$1",
        [kind === "actor_suspended" ? parent.id : tutor.id],
      );
    if (kind.endsWith("unverified"))
      await world.owner.pool.query(
        'UPDATE "user" SET email_verified=false WHERE id=$1',
        [kind === "actor_unverified" ? parent.id : tutor.id],
      );
    if (kind === "learner_inactive")
      await world.owner.pool.query(
        "UPDATE learner_profiles SET status='inactive' WHERE id=$1",
        [guardianId],
      );
    if (kind === "tutor_role_removed")
      await world.owner.pool.query(
        "DELETE FROM user_roles WHERE user_id=$1 AND role='tutor'",
        [tutor.id],
      );
    try {
      await rejected(read(parent, id));
    } finally {
      await world.owner.pool.query(
        "UPDATE user_access SET status='active' WHERE user_id IN ($1,$2)",
        [parent.id, tutor.id],
      );
      await world.owner.pool.query(
        'UPDATE "user" SET email_verified=true WHERE id IN ($1,$2)',
        [parent.id, tutor.id],
      );
      await world.owner.pool.query(
        "UPDATE learner_profiles SET status='active' WHERE id=$1",
        [guardianId],
      );
      await world.owner.pool.query(
        "INSERT INTO user_roles(user_id,role) VALUES($1,'tutor') ON CONFLICT DO NOTHING",
        [tutor.id],
      );
    }
  });
  it("elapsed/materialized expiry returns no URL, denies save and retains records", async () => {
    const id = await booking({ remaining: 250 });
    await save(tutor, id);
    await delay(300);
    expect(await read(parent, id)).toEqual({ state: "expired" });
    await rejected(save(tutor, id, input(1)));
    expect(
      (
        await world.owner.pool.query(
          "SELECT url FROM booking_meeting_links WHERE booking_id=$1",
          [id],
        )
      ).rows[0].url,
    ).toBe(url);
    const state = await booking({ state: "demo_expired" });
    await rejected(save(tutor, state));
    expect(await read(tutor, state)).toEqual({ state: "expired" });
  });
  it("identical retry has one safe audit; changed/older retry cannot replace newer revision", async () => {
    const id = await booking(),
      payload = input();
    await save(tutor, id, payload);
    await save(tutor, id, payload);
    await rejected(save(tutor, id, { ...payload, url: replacement }), 409);
    await save(tutor, id, input(1, replacement));
    await rejected(save(tutor, id, payload), 409);
    await rejected(save(tutor, id, { ...payload, expectedRevision: 2 }), 409);
    const rows = (
      await world.owner.pool.query(
        "SELECT * FROM booking_meeting_link_events WHERE booking_id=$1 ORDER BY revision",
        [id],
      )
    ).rows;
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.revision)).toEqual([1, 2]);
    expect(JSON.stringify(rows)).not.toContain(url);
    expect(
      rows.every(
        (row) => row.actor_kind === "human" && row.automation_job_id === null,
      ),
    ).toBe(true);
    expect(Object.keys(rows[0]).sort()).toEqual([
      "actor_kind",
      "actor_user_id",
      "automation_job_id",
      "booking_id",
      "created_at",
      "id",
      "request_id",
      "revision",
    ]);
  });
  it.each([false, true])(
    "concurrent distinct stale edits preserve exactly one winner (reverse=%s)",
    async (reverse) => {
      const id = await booking();
      await save(tutor, id);
      const payloads = [input(1), input(1, replacement)];
      if (reverse) payloads.reverse();
      const results = await Promise.allSettled(
        payloads.map((p) => save(tutor, id, p)),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      expect(await read(tutor, id)).toMatchObject({ revision: 2 });
      expect(
        (
          await world.owner.pool.query(
            "SELECT count(*)::int AS count FROM booking_meeting_link_events WHERE booking_id=$1",
            [id],
          )
        ).rows[0].count,
      ).toBe(2);
    },
  );
  it("concurrent same request creates one revision and one audit", async () => {
    const id = await booking(),
      payload = input();
    expect(
      await Promise.all([save(tutor, id, payload), save(tutor, id, payload)]),
    ).toEqual([{ revision: 1 }, { revision: 1 }]);
    expect(
      (
        await world.owner.pool.query(
          "SELECT count(*)::int AS count FROM booking_meeting_link_events WHERE booking_id=$1",
          [id],
        )
      ).rows[0].count,
    ).toBe(1);
  });
  it.each(["expiry", "suspension", "role", "session"])(
    "rechecks %s after observed tutor lock wait with no partial writes",
    async (kind) => {
      const id = await booking({ remaining: kind === "expiry" ? 300 : 600000 });
      const blocker = await world.owner.pool.connect();
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
        [profileId],
      );
      const pending = save(tutor, id);
      const settled = pending.then(
        () => ({ status: 200 }),
        (e) => ({ status: e.status }),
      );
      try {
        await waitForLock();
        if (kind === "expiry") await delay(350);
        if (kind === "suspension")
          await world.owner.pool.query(
            "UPDATE user_access SET status='suspended' WHERE user_id=$1",
            [tutor.id],
          );
        if (kind === "role")
          await world.owner.pool.query(
            "DELETE FROM user_roles WHERE user_id=$1 AND role='tutor'",
            [tutor.id],
          );
        if (kind === "session")
          await world.owner.pool.query(
            "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
            [tutor.id],
          );
        await blocker.query("COMMIT");
        expect(await settled).toEqual({ status: 404 });
        expect(
          (
            await world.owner.pool.query(
              "SELECT count(*)::int AS count FROM booking_meeting_links WHERE booking_id=$1",
              [id],
            )
          ).rows[0].count,
        ).toBe(0);
        expect(
          (
            await world.owner.pool.query(
              "SELECT count(*)::int AS count FROM booking_meeting_link_events WHERE booking_id=$1",
              [id],
            )
          ).rows[0].count,
        ).toBe(0);
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
        await world.owner.pool.query(
          "UPDATE user_access SET status='active' WHERE user_id=$1",
          [tutor.id],
        );
        await world.owner.pool.query(
          "INSERT INTO user_roles(user_id,role) VALUES($1,'tutor') ON CONFLICT DO NOTHING",
          [tutor.id],
        );
        if (kind === "session")
          await world.owner.pool.query(
            "UPDATE session SET expires_at=clock_timestamp()+interval '1 day' WHERE user_id=$1",
            [tutor.id],
          );
      }
    },
  );
  it("safe HTTP boundary, strict payload, no-store redirects and no raw exception leakage", async () => {
    const id = await booking();
    const put = (body: unknown, origin = world.runtime.origin) =>
      handleMeetingEdit(
        world.runtime,
        jsonRequest(world, `/api/bookings/${id}/meeting-link`, {
          method: "PUT",
          cookie: tutor.cookie,
          body,
          origin,
        }),
        id,
      );
    expect((await put({ ...input(), userId: other.id })).status).toBe(400);
    expect((await put(input(), "https://evil.test")).status).toBe(403);
    expect(
      (
        await handleMeetingRead(
          world.runtime,
          jsonRequest(world, "/api/meeting", { method: "GET" }),
          id,
        )
      ).status,
    ).toBe(401);
    const saved = await put(input());
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ revision: 1 });
    expect(saved.headers.get("cache-control")).toContain("no-store");
    const open = await handleMeetingRead(
      world.runtime,
      jsonRequest(world, `/api/bookings/${id}/meeting-link?open=1`, {
        method: "GET",
        cookie: parent.cookie,
      }),
      id,
    );
    expect(open.status).toBe(303);
    expect(open.headers.get("location")).toBe(url);
    expect(open.headers.get("referrer-policy")).toBe("no-referrer");
    const bad = await handleMeetingRead(
      world.runtime,
      jsonRequest(world, `/api/bookings/${id}/meeting-link?open=1&open=1`, {
        method: "GET",
        cookie: parent.cookie,
      }),
      id,
    );
    expect(bad.status).toBe(400);
    const unavailable = await handleMeetingRead(
      null,
      jsonRequest(world, "/api/meeting", { method: "GET" }),
      id,
    );
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain(url);
  });
  it("restricted runtime cannot delete/edit audit, move booking owner or regress revisions", async () => {
    const id = await booking();
    await save(tutor, id);
    for (const query of [
      "DELETE FROM booking_meeting_links WHERE booking_id=$1",
      "UPDATE booking_meeting_links SET booking_id=booking_id WHERE booking_id=$1",
      "DELETE FROM booking_meeting_link_events WHERE booking_id=$1",
      "UPDATE booking_meeting_link_events SET revision=99 WHERE booking_id=$1",
    ])
      await expect(world.runtime.pool.query(query, [id])).rejects.toMatchObject(
        { code: "42501" },
      );
    await expect(
      world.runtime.pool.query(
        "UPDATE booking_meeting_links SET revision=1 WHERE booking_id=$1",
        [id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
