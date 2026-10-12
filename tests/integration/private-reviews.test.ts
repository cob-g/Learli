import { handleAuthRequest } from "@/lib/auth-handler";
import { writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  password,
  openWorld,
  closeWorld,
  createAccount,
  jsonRequest,
  type World,
  type TestAccount,
} from "./support";
import { completeHistoricalDemoFixture } from "@/features/bookings/fixture-tooling";
import {
  submitReview,
  moderateReview,
  readAuthorReview,
  readModeratorReview,
  listModeratorReviews,
} from "@/features/private-reviews/service";
import {
  provisionReviewModerator,
  provisionReviewGrant,
  prepareHistoricalReviewFixture,
} from "@/features/private-reviews/fixture-tooling";
import { handleReview } from "@/features/private-reviews/handler";
let world: World,
  parent: TestAccount,
  other: TestAccount,
  tutor: TestAccount,
  moderator: TestAccount,
  unscoped: TestAccount,
  self: TestAccount;
let profile: string,
  learner: string,
  selfLearner: string,
  subject: string,
  sequence = 0;
const submission = (
  expectedRevision = 0,
  requestId = randomUUID(),
  rating = 4,
  comment = "Private synthetic text",
) => ({ expectedRevision, requestId, rating, comment });
const moderation = (
  expectedRevision = 0,
  state = "locally_approved",
  requestId = randomUUID(),
) => ({ expectedRevision, state, requestId });
async function fixture({
  independent = false,
  state = "demo_reserved",
  future = false,
  complete = true,
}: {
  independent?: boolean;
  state?: string;
  future?: boolean;
  complete?: boolean;
} = {}) {
  const id = randomUUID();
  const start = new Date(
    Date.now() + (future ? 1 : -1) * (++sequence + 2) * 86400000,
  );
  await world.owner.pool.query(
    `INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) VALUES($1,'local_simulation',$2,$3,$4,$5,$6,$7,'UTC',$8,$9,$10,clock_timestamp(),clock_timestamp()+interval '10 minutes')`,
    [
      id,
      profile,
      independent ? selfLearner : learner,
      independent ? self.id : parent.id,
      subject,
      start,
      new Date(start.getTime() + 3600000),
      randomUUID(),
      "a".repeat(64),
      state,
    ],
  );
  await world.owner.pool.query(
    "INSERT INTO booking_events(booking_id,event) VALUES($1,'demo_reserved')",
    [id],
  );
  if (complete) await completeHistoricalDemoFixture(world.owner, id);
  return id;
}
const submit = (id: string, payload: unknown = submission(), a = parent) =>
  submitReview(world.runtime, a.headers, id, payload);
const change = (id: string, payload: unknown = moderation(), a = moderator) =>
  moderateReview(world.runtime, a.headers, id, payload);
const authorRead = (id: string, a = parent) =>
  readAuthorReview(world.runtime, a.headers, id);
const modRead = (id: string, a = moderator) =>
  readModeratorReview(world.runtime, a.headers, id);
async function scoped(id: string) {
  const saved = await submit(id);
  await provisionReviewGrant(world.owner, moderator.id, saved.id, "authorized");
  return saved.id;
}
async function denied(p: Promise<unknown>, status = 404) {
  await expect(p).rejects.toMatchObject({ status });
}
async function waitForLock() {
  for (let i = 0; i < 200; i++) {
    const r = await world.owner.pool.query(
      "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND usename='learli_app' AND wait_event_type='Lock'",
    );
    if (r.rowCount) return;
    await delay(10);
  }
  throw new Error("Owned runtime lock wait absent.");
}
beforeAll(async () => {
  world = openWorld();
  parent = await createAccount(world, ["parent"]);
  other = await createAccount(world, ["parent"]);
  tutor = await createAccount(world, ["tutor", "admin"]);
  moderator = await createAccount(world, ["admin"]);
  unscoped = await createAccount(world, ["admin"]);
  self = await createAccount(world, ["student"]);
  subject = (
    await world.owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
  ).rows[0].id;
  profile = (
    await world.owner.pool.query(
      "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,'Synthetic only','Synthetic only','Fixture','UTC','approved') RETURNING id",
      [tutor.id, `private-review-${randomUUID()}`],
    )
  ).rows[0].id;
  for (const independent of [false, true]) {
    const r = await world.owner.pool.query(
      "INSERT INTO learner_profiles(fixture_key,source,management,user_id,display_name,level,timezone) VALUES($1,'local_fixture',$2,$3,'Synthetic review learner',$4,'UTC') RETURNING id",
      [
        randomUUID(),
        independent ? "self" : "guardian",
        independent ? self.id : null,
        independent ? "college_support" : "elementary",
      ],
    );
    if (independent) selfLearner = r.rows[0].id;
    else learner = r.rows[0].id;
  }
  await world.owner.pool.query(
    "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
    [parent.id, learner],
  );
  await provisionReviewModerator(world.owner, moderator.id, "authorized");
}, 60000);
afterAll(() => closeWorld(world));
describe("private booking-backed reviews on actual PostgreSQL", () => {
  it("saves immutable completed parent/self reviews, plain text and private audit; identical replay is stable", async () => {
    const id = await fixture(),
      payload = submission(0, randomUUID(), 5, "<script>synthetic</script>");
    const r = await submit(id, payload);
    expect(await submit(id, payload)).toEqual(r);
    expect((await authorRead(id)).review).toMatchObject({
      id: r.id,
      rating: 5,
      comment: payload.comment,
      state: "pending",
      revision: 0,
    });
    const own = await fixture({ independent: true });
    await submit(own, submission(), self);
    expect((await authorRead(own, self)).review?.rating).toBe(4);
    await denied(authorRead(own));
    const audit = (
      await world.owner.pool.query(
        "SELECT * FROM private_review_events WHERE review_id=$1",
        [r.id],
      )
    ).rows;
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain(payload.comment);
  });
  it("rejects unrelated guardians, tutor, unscoped admin, invalid/missing and anonymous", async () => {
    const id = await fixture();
    for (const a of [other, tutor, unscoped]) {
      await denied(submit(id, submission(), a));
      await denied(authorRead(id, a));
    }
    await denied(authorRead(randomUUID()));
    await denied(authorRead("bad"));
    const response = await handleReview(
      world.runtime,
      jsonRequest(world, `/api/bookings/${id}/review`, { method: "GET" }),
      "author",
      id,
    );
    expect(response.status).toBe(401);
  });
  it.each([
    "demo_reserved",
    "demo_expired",
    "demo_cancelled",
    "demo_confirmed",
  ])(
    "rejects ineligible %s fixture and preserves zero writes",
    async (state) => {
      const id = await fixture({ state, complete: false });
      await denied(submit(id));
      await denied(authorRead(id));
      expect(
        (
          await world.owner.pool.query(
            "SELECT count(*)::int n FROM private_booking_reviews WHERE booking_id=$1",
            [id],
          )
        ).rows[0].n,
      ).toBe(0);
    },
  );
  it("rejects future completed fixture at DB and owner completion without clock bypass", async () => {
    const id = await fixture({ future: true, complete: false });
    await expect(
      completeHistoricalDemoFixture(world.owner, id),
    ).rejects.toThrow();
    await denied(submit(id));
  });
  it("requires owner completion event even for owner-inserted completed state", async () => {
    const id = await fixture({ state: "demo_completed", complete: false });
    await denied(submit(id));
    await denied(authorRead(id));
  });
  it("rejects stale revision, changed retry and same key on another booking", async () => {
    const id = await fixture(),
      payload = submission();
    await denied(submit(id, submission(9)), 409);
    const r = await submit(id, payload);
    await denied(submit(id, { ...payload, rating: 2 }), 409);
    await denied(submit(id, submission()), 409);
    const otherBooking = await fixture();
    await denied(submit(otherBooking, payload), 409);
    expect((await authorRead(id)).review?.id).toBe(r.id);
  });
  it("serializes identical concurrent submissions and different authorized guardian contenders", async () => {
    const id = await fixture(),
      payload = submission();
    const same = await Promise.all([submit(id, payload), submit(id, payload)]);
    expect(same[0]).toEqual(same[1]);
    await world.owner.pool.query(
      "INSERT INTO guardian_learner_links(guardian_user_id,learner_id,source,status) VALUES($1,$2,'local_fixture','authorized')",
      [other.id, learner],
    );
    try {
      const different = await fixture();
      const r = await Promise.allSettled([
        submit(different),
        submit(different, submission(), other),
      ]);
      expect(r.filter((v) => v.status === "fulfilled")).toHaveLength(1);
      expect(r.filter((v) => v.status === "rejected")).toHaveLength(1);
      expect(
        (
          await world.owner.pool.query(
            "SELECT count(*)::int n FROM private_booking_reviews WHERE booking_id=$1",
            [different],
          )
        ).rows[0].n,
      ).toBe(1);
    } finally {
      await world.owner.pool.query(
        "DELETE FROM guardian_learner_links WHERE guardian_user_id=$1 AND learner_id=$2",
        [other.id, learner],
      );
    }
  });
  it("disallows retired physical predecessor and grants only current completed head", async () => {
    const old = await fixture({ state: "demo_replaced", complete: false });
    const root = (
      await world.owner.pool.query("SELECT * FROM bookings WHERE id=$1", [old])
    ).rows[0];
    const head = randomUUID();
    await world.owner.pool.query(
      `INSERT INTO bookings(id,logical_booking_id,replaces_booking_id,revision,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) VALUES($1,$2,$2,1,'local_simulation',$3,$4,$5,$6,$7,$8,'UTC',$9,$10,'demo_reserved',clock_timestamp(),(SELECT expires_at FROM bookings WHERE id=$2))`,
      [
        head,
        old,
        profile,
        learner,
        parent.id,
        subject,
        root.start_at_utc,
        root.end_at_utc,
        randomUUID(),
        "b".repeat(64),
      ],
    );
    await completeHistoricalDemoFixture(world.owner, head);
    await denied(submit(old));
    await denied(submit(head, submission(0)), 409);
    await submit(head, submission(1));
  });
  it("current author link/role/status/verification/learner changes block reads/replay; tutor eligibility does not", async () => {
    const id = await fixture(),
      payload = submission();
    await submit(id, payload);
    const changes = [
      [
        "UPDATE guardian_learner_links SET status=$1 WHERE guardian_user_id=$2 AND learner_id=$3",
        ["revoked", parent.id, learner],
        ["authorized", parent.id, learner],
      ],
      [
        "UPDATE user_access SET status=$1 WHERE user_id=$2",
        ["suspended", parent.id],
        ["active", parent.id],
      ],
      [
        'UPDATE "user" SET email_verified=$1 WHERE id=$2',
        [false, parent.id],
        [true, parent.id],
      ],
      [
        "UPDATE learner_profiles SET status=$1 WHERE id=$2",
        ["inactive", learner],
        ["active", learner],
      ],
    ] as const;
    for (const [query, off, on] of changes) {
      await world.owner.pool.query(query, [...off]);
      try {
        await expect(authorRead(id)).rejects.toBeTruthy();
        await expect(submit(id, payload)).rejects.toBeTruthy();
      } finally {
        await world.owner.pool.query(query, [...on]);
      }
    }
    await world.owner.pool.query(
      "DELETE FROM user_roles WHERE user_id=$1 AND role='parent'",
      [parent.id],
    );
    try {
      await denied(submit(id, payload));
      await denied(authorRead(id));
    } finally {
      await world.owner.pool.query(
        "INSERT INTO user_roles(user_id,role) VALUES($1,'parent')",
        [parent.id],
      );
    }
    await world.owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE id=$1",
      [profile],
    );
    await world.owner.pool.query(
      "UPDATE user_access SET status='suspended' WHERE user_id=$1",
      [tutor.id],
    );
    try {
      expect((await authorRead(id)).review).toBeTruthy();
      expect(await submit(id, payload)).toBeTruthy();
    } finally {
      await world.owner.pool.query(
        "UPDATE tutor_profiles SET review_status='approved' WHERE id=$1",
        [profile],
      );
      await world.owner.pool.query(
        "UPDATE user_access SET status='active' WHERE user_id=$1",
        [tutor.id],
      );
    }
  });
  it("moderator requires separate capability AND exact grant; author/tutor never moderate own teaching", async () => {
    const id = await fixture(),
      saved = await submit(id);
    await denied(modRead(saved.id));
    await denied(change(saved.id));
    await provisionReviewGrant(
      world.owner,
      moderator.id,
      saved.id,
      "authorized",
    );
    expect((await modRead(saved.id)).comment).toBe("Private synthetic text");
    expect(
      (await listModeratorReviews(world.runtime, unscoped.headers)).reviews,
    ).toEqual([]);
    await denied(modRead(saved.id, unscoped));
    await provisionReviewModerator(world.owner, tutor.id, "authorized");
    await expect(
      provisionReviewGrant(world.owner, tutor.id, saved.id, "authorized"),
    ).rejects.toThrow();
    await world.owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
      [parent.id],
    );
    await provisionReviewModerator(world.owner, parent.id, "authorized");
    await expect(
      provisionReviewGrant(world.owner, parent.id, saved.id, "authorized"),
    ).rejects.toThrow();
    await denied(modRead(saved.id, parent));
    // Even an invalid owner-provisioned exact grant cannot defeat self/tutor exclusion.
    for (const account of [parent, tutor]) {
      await world.owner.pool.query(
        "INSERT INTO review_moderator_grants(review_id,moderator_user_id,status) VALUES($1,$2,'authorized')",
        [saved.id, account.id],
      );
      await denied(modRead(saved.id, account));
      await denied(change(saved.id, moderation(), account));
    }
    expect(JSON.stringify(await modRead(saved.id))).not.toContain(learner);
    expect(JSON.stringify(await modRead(saved.id))).not.toContain(parent.id);
  });
  it("private decisions and explicit reconsideration preserve revision/retry/audit without direct flip", async () => {
    const review = await scoped(await fixture()),
      payload = moderation();
    expect(await change(review, payload)).toEqual({ id: review, revision: 1 });
    expect(await change(review, payload)).toEqual({ id: review, revision: 1 });
    await denied(
      change(review, { ...payload, state: "locally_rejected" }),
      409,
    );
    await denied(change(review, moderation(1, "locally_rejected")), 400);
    expect(await change(review, moderation(1, "pending"))).toEqual({
      id: review,
      revision: 2,
    });
    await denied(change(review, payload), 409);
    await change(review, moderation(2, "locally_rejected"));
    expect((await modRead(review)).state).toBe("locally_rejected");
    expect((await modRead(review)).history).toHaveLength(4);
  });
  it("same moderation replay races create one event; stale competing decisions create one winner", async () => {
    const id = await scoped(await fixture()),
      payload = moderation();
    const identical = await Promise.all([
      change(id, payload),
      change(id, payload),
    ]);
    expect(identical[0]).toEqual(identical[1]);
    const next = await scoped(await fixture());
    const both = await Promise.allSettled([
      change(next),
      change(next, moderation(0, "locally_rejected")),
    ]);
    expect(both.filter((v) => v.status === "fulfilled")).toHaveLength(1);
    expect((await modRead(next)).history).toHaveLength(2);
  });
  it.each(["link", "session", "role"])(
    "fresh %s revocation after observed tutor wait blocks identical author replay",
    async (kind) => {
      const id = await fixture(),
        payload = submission();
      await submit(id, payload);
      const blocker = await world.owner.pool.connect();
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
        [profile],
      );
      const pending = submit(id, payload).then(
        () => 200,
        (e) => e.status,
      );
      try {
        await waitForLock();
        if (kind === "link")
          await world.owner.pool.query(
            "UPDATE guardian_learner_links SET status='revoked' WHERE guardian_user_id=$1 AND learner_id=$2",
            [parent.id, learner],
          );
        if (kind === "session")
          await world.owner.pool.query(
            "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
            [parent.id],
          );
        if (kind === "role")
          await world.owner.pool.query(
            "DELETE FROM user_roles WHERE user_id=$1 AND role='parent'",
            [parent.id],
          );
        await blocker.query("COMMIT");
        expect(await pending).toBe(404);
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
        await world.owner.pool.query(
          "UPDATE guardian_learner_links SET status='authorized' WHERE guardian_user_id=$1 AND learner_id=$2",
          [parent.id, learner],
        );
        await world.owner.pool.query(
          "UPDATE session SET expires_at=clock_timestamp()+interval '1 day' WHERE user_id=$1",
          [parent.id],
        );
        await world.owner.pool.query(
          "INSERT INTO user_roles(user_id,role) VALUES($1,'parent') ON CONFLICT DO NOTHING",
          [parent.id],
        );
      }
    },
  );
  it.each(["capability", "grant", "session", "role"])(
    "fresh moderator %s revocation after observed tutor wait blocks change and retry",
    async (kind) => {
      const id = await scoped(await fixture()),
        payload = moderation();
      await change(id, payload);
      const blocker = await world.owner.pool.connect();
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
        [profile],
      );
      const pending = change(id, payload).then(
        () => 200,
        (e) => e.status,
      );
      try {
        await waitForLock();
        if (kind === "capability")
          await world.owner.pool.query(
            "UPDATE review_moderators SET status='revoked' WHERE user_id=$1",
            [moderator.id],
          );
        if (kind === "grant")
          await world.owner.pool.query(
            "UPDATE review_moderator_grants SET status='revoked' WHERE moderator_user_id=$1 AND review_id=$2",
            [moderator.id, id],
          );
        if (kind === "session")
          await world.owner.pool.query(
            "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
            [moderator.id],
          );
        if (kind === "role")
          await world.owner.pool.query(
            "DELETE FROM user_roles WHERE user_id=$1 AND role='admin'",
            [moderator.id],
          );
        await blocker.query("COMMIT");
        expect(await pending).toBe(404);
        await expect(modRead(id)).rejects.toBeTruthy();
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
        await world.owner.pool.query(
          "UPDATE review_moderators SET status='authorized' WHERE user_id=$1",
          [moderator.id],
        );
        await world.owner.pool.query(
          "UPDATE review_moderator_grants SET status='authorized' WHERE moderator_user_id=$1 AND review_id=$2",
          [moderator.id, id],
        );
        await world.owner.pool.query(
          "UPDATE session SET expires_at=clock_timestamp()+interval '1 day' WHERE user_id=$1",
          [moderator.id],
        );
        await world.owner.pool.query(
          "INSERT INTO user_roles(user_id,role) VALUES($1,'admin') ON CONFLICT DO NOTHING",
          [moderator.id],
        );
        if (kind === "session") {
          const signed = await handleAuthRequest(
            world.runtime,
            jsonRequest(world, "/api/auth/sign-in/email", {
              body: { email: moderator.email, password },
            }),
          );
          expect(signed.status).toBe(200);
          moderator.cookie = signed.headers
            .getSetCookie()
            .map((v) => v.split(";")[0])
            .join("; ");
          moderator.headers = new Headers({ cookie: moderator.cookie });
        }
      }
    },
  );
  it("runtime cannot write submissions/grants/audit/promote; triggers preserve owner audit and submission", async () => {
    const id = await fixture(),
      review = await scoped(id);
    for (const query of [
      "UPDATE private_booking_reviews SET rating=1",
      "DELETE FROM private_booking_reviews",
      "INSERT INTO review_moderators(user_id,status) SELECT id,'authorized' FROM \"user\" LIMIT 1",
      "UPDATE review_moderator_grants SET status='revoked'",
      "DELETE FROM private_review_events",
      "SELECT public.private_review_author_allowed('a','b',gen_random_uuid())",
    ])
      await expect(world.runtime.pool.query(query)).rejects.toMatchObject({
        code: "42501",
      });
    await expect(
      world.owner.pool.query(
        "UPDATE private_booking_reviews SET rating=2 WHERE id=$1",
        [review],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      world.owner.pool.query(
        "DELETE FROM private_review_events WHERE review_id=$1",
        [review],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    const reserved = await fixture({ future: true, complete: false });
    await expect(
      world.runtime.pool.query(
        "UPDATE bookings SET state='demo_completed' WHERE id=$1",
        [reserved],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("boundary preserves no-store/noindex and denies cross-origin/oversized/unknown fields", async () => {
    const id = await fixture();
    const response = await handleReview(
      world.runtime,
      jsonRequest(world, `/api/bookings/${id}/review`, {
        method: "GET",
        cookie: parent.cookie,
      }),
      "author",
      id,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    const cross = await handleReview(
      world.runtime,
      jsonRequest(world, `/api/bookings/${id}/review`, {
        cookie: parent.cookie,
        origin: "https://evil.test",
        body: submission(),
      }),
      "author",
      id,
    );
    expect(cross.status).toBe(403);
    const invalid = await handleReview(
      world.runtime,
      jsonRequest(world, `/api/bookings/${id}/review`, {
        cookie: parent.cookie,
        body: { ...submission(), author: other.id },
      }),
      "author",
      id,
    );
    expect(invalid.status).toBe(400);
    const oversized = await handleReview(
      world.runtime,
      jsonRequest(world, `/api/bookings/${id}/review`, {
        cookie: parent.cookie,
        body: { ...submission(), comment: "a".repeat(9000) },
      }),
      "author",
      id,
    );
    expect(oversized.status).toBe(400);
    expect(oversized.headers.get("x-robots-tag")).toContain("noindex");
  });
  it("owner historical preparation is usable, stable on concurrent retry and rejects changed/future/foreign input", async () => {
    const familyLabel = `family-${randomUUID()}`,
      tutorLabel = `tutor-${randomUUID()}`;
    const familyEmail = `${familyLabel}@fixtures.learli.test`,
      tutorEmail = `${tutorLabel}@fixtures.learli.test`;
    await world.owner.pool.query('UPDATE "user" SET email=$2 WHERE id=$1', [
      parent.id,
      familyEmail,
    ]);
    await world.owner.pool.query('UPDATE "user" SET email=$2 WHERE id=$1', [
      tutor.id,
      tutorEmail,
    ]);
    await world.owner.pool.query(
      "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) VALUES($1,$2,ARRAY['elementary']) ON CONFLICT DO NOTHING",
      [profile, subject],
    );
    mkdirSync(".local", { recursive: true });
    writeFileSync(
      ".local/private-review-fixtures.test.json",
      JSON.stringify([
        { email: familyEmail, userId: parent.id, roles: ["parent"] },
        { email: tutorEmail, userId: tutor.id, roles: ["tutor"] },
      ]),
      { mode: 0o600 },
    );
    const start = new Date(Date.now() - 200 * 86400000),
      end = new Date(start.getTime() + 3600000);
    const v = {
      familyLabel,
      tutorLabel,
      learnerId: learner,
      subjectSlug: "math",
      start: start.toISOString(),
      end: end.toISOString(),
      requestId: randomUUID(),
    };
    const prepare = () => prepareHistoricalReviewFixture(world.owner, v, true);
    const result = await Promise.all([prepare(), prepare()]);
    expect(result[0]).toEqual(result[1]);
    expect(result[0].completed).toBe(true);
    const original = (
      await world.owner.pool.query(
        "SELECT created_at,expires_at,start_at_utc,end_at_utc FROM bookings WHERE id=$1",
        [result[0].id],
      )
    ).rows[0];
    expect(await prepare()).toEqual(result[0]);
    expect(
      (
        await world.owner.pool.query(
          "SELECT created_at,expires_at,start_at_utc,end_at_utc FROM bookings WHERE id=$1",
          [result[0].id],
        )
      ).rows[0],
    ).toEqual(original);
    await expect(
      prepareHistoricalReviewFixture(
        world.owner,
        {
          ...v,
          start: new Date(start.getTime() + 1000).toISOString(),
          end: new Date(end.getTime() + 1000).toISOString(),
        },
        true,
      ),
    ).rejects.toThrow();
    await expect(
      prepareHistoricalReviewFixture(
        world.owner,
        { ...v, familyLabel: "foreign" },
        true,
      ),
    ).rejects.toThrow();
    await expect(
      prepareHistoricalReviewFixture(world.runtime, { ...v }, true),
    ).rejects.toThrow();
    const future = new Date(Date.now() + 86400000);
    await expect(
      prepareHistoricalReviewFixture(
        world.owner,
        {
          ...v,
          start: future.toISOString(),
          end: new Date(future.getTime() + 3600000).toISOString(),
          requestId: randomUUID(),
        },
        true,
      ),
    ).rejects.toThrow();
    await submit(result[0].id);
    expect((await authorRead(result[0].id)).review).toBeTruthy();
  });
});
