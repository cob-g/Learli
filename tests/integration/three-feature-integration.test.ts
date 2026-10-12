import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { handleAccountEmail } from "@/features/account-email/handler";
import { handleSubjectRenameRequest } from "@/features/subjects/handler";
import {
  createSpecializedSubject,
  setSubjectActive,
} from "@/features/subjects/service";
import { listEligibleTutors } from "@/features/tutors/eligibility";
import { readDirectoryAvailability } from "@/features/tutors/directory-availability";
import { readMatchingAvailability } from "@/features/matching/service";
import { readParticipantBooking } from "@/features/bookings/read-service";
import { readSimulationNoticeRecipient } from "@/features/bookings/read-notice";
import { dispatchPendingBookingNotices } from "@/features/booking-notifications/dispatch";
import {
  bookingNoticeKey,
  bookingNoticeMailbox,
} from "@/features/booking-notifications/local-capture";
import {
  readPrivateMeetingLink,
  savePrivateMeetingLink,
} from "@/features/booking-meeting-links/service";
import { listMyLearners } from "@/features/learners/service";
import { requireIdentity } from "@/lib/permissions/access";
import { localMailbox, type LocalMessage } from "@/lib/email/local-mail";
import { handleAuthRequest } from "@/lib/auth-handler";
import {
  familyLearner,
  familyReservation,
  familyTutor,
} from "../support/family-fixtures";
import {
  closeWorld,
  createAccount,
  jsonRequest,
  openWorld,
  password,
  type World,
  type TestAccount,
} from "./support";

let world: World;
const ownedProfiles: string[] = [];
const preferences = { timezone: "UTC", when: "any" as const };
const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
const change = (account: TestAccount, body: unknown) =>
  handleAccountEmail(
    world.runtime,
    jsonRequest(world, "/api/account/email", { cookie: account.cookie, body }),
  );
const rename = (
  account: TestAccount,
  id: string,
  name: string,
  expectedRevision = 0,
) =>
  handleSubjectRenameRequest(
    world.runtime,
    jsonRequest(world, `/api/admin/subjects/${id}/name`, {
      method: "PATCH",
      cookie: account.cookie,
      body: { name, expectedRevision },
    }),
    id,
  );
async function code(
  email: string,
  kind: "email-change-current" | "email-change-new",
) {
  const directory = localMailbox("test");
  for (const file of (await readdir(directory))
    .filter((v) => v.endsWith(".json"))
    .sort()
    .reverse()) {
    const value = JSON.parse(
      await readFile(path.join(directory, file), "utf8"),
    ) as LocalMessage;
    if (value.to === email && value.kind === kind && "otp" in value)
      return value.otp;
  }
  throw Error("Expected owned private email proof.");
}
async function prepare(account: TestAccount) {
  const newEmail = `combined-${randomUUID()}@learli.test`;
  expect((await change(account, { action: "start" })).status).toBe(200);
  expect(
    (
      await change(account, {
        action: "request",
        newEmail,
        code: await code(account.email, "email-change-current"),
      })
    ).status,
  ).toBe(200);
  return {
    newEmail,
    body: {
      action: "confirm",
      newEmail,
      code: await code(newEmail, "email-change-new"),
    },
  };
}
async function profile(account?: TestAccount) {
  const id = account
    ? ((
        await world.owner.pool.query(
          "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone,review_status) VALUES($1,$2,'Synthetic','Synthetic only','Fixture','UTC','approved') RETURNING id",
          [account.id, `combined-${randomUUID()}`],
        )
      ).rows[0].id as string)
    : await familyTutor(world.owner.pool);
  ownedProfiles.push(id);
  return id;
}
beforeAll(() => {
  world = openWorld();
});
beforeEach(() => world.owner.pool.query("UPDATE rate_limit SET count=0"));
afterAll(async () => {
  if (ownedProfiles.length)
    await world.owner.pool.query(
      "UPDATE tutor_profiles SET review_status='suspended' WHERE id=ANY($1::uuid[])",
      [ownedProfiles],
    );
  await closeWorld(world);
});

describe("combined frozen feature boundaries on real PostgreSQL", () => {
  it("normalizes a real provider failure without logging session tokens while retaining committed email and uncertain revocation", async () => {
    const account = await createAccount(world);
    const otherLogin = await handleAuthRequest(
      world.runtime,
      jsonRequest(world, "/api/auth/sign-in/email", {
        body: { email: account.email, password },
      }),
    );
    expect(otherLogin.status).toBe(200);
    const pending = await prepare(account);
    const fixture = `combined_auth_failure_${randomUUID().replaceAll("-", "")}`;
    // Test-only observation retains zero-call assertion and prevents unsafe failure
    // diagnostics if the provider ever regresses. Runtime console is not replaced.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await world.owner.pool.query(
        `CREATE FUNCTION ${fixture}() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN IF OLD.user_id=TG_ARGV[0] THEN RAISE EXCEPTION 'Synthetic provider failure'; END IF; RETURN OLD; END $f$`,
      );
      await world.owner.pool.query(
        `CREATE TRIGGER ${fixture} BEFORE DELETE ON session FOR EACH ROW EXECUTE FUNCTION ${fixture}('${account.id}')`,
      );
      const result = await change(account, pending.body);
      expect(result.status).toBe(503);
      expect((await result.json()).code).toBe("CHANGE_UNCERTAIN");
      expect(logged.mock.calls.length).toBe(0);
      const row = (
        await world.owner.pool.query(
          'SELECT email,email_verified FROM "user" WHERE id=$1',
          [account.id],
        )
      ).rows[0];
      expect(row.email === pending.newEmail && row.email_verified).toBe(true);
      expect(
        (
          await world.owner.pool.query(
            "SELECT count(*)::int AS n FROM session WHERE user_id=$1",
            [account.id],
          )
        ).rows[0].n,
      ).toBeGreaterThan(1);
    } finally {
      logged.mockRestore();
      await world.owner.pool.query(
        `DROP TRIGGER IF EXISTS ${fixture} ON session`,
      );
      await world.owner.pool.query(`DROP FUNCTION IF EXISTS ${fixture}()`);
    }
  });
  it("renames a 21-tutor dated inventory without changing offerings or booking history, then deactivation agrees everywhere", async () => {
    const admin = await createAccount(world, ["admin"]);
    const parent = await createAccount(world, ["parent"]);
    const subject = await createSpecializedSubject(
      world.runtime,
      admin.headers,
      { name: `Combined ${randomUUID()}` },
    );
    for (let i = 0; i < 21; i++) {
      const id = await profile();
      await world.owner.pool.query(
        "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) VALUES($1,$2,ARRAY['college_support'])",
        [id, subject.id],
      );
      await world.owner.pool.query(
        "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) SELECT $1,n,0,1440 FROM generate_series(1,7) n",
        [id],
      );
    }
    const learnerId = await familyLearner(
      world.owner.pool,
      parent.id,
      "guardian",
      "PRIVATE COMBINED TEST LEARNER",
    );
    const bookingId = randomUUID();
    await world.owner.pool.query(
      "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at) VALUES($1,'local_simulation',$2,$3,$4,$5,now()+interval '3 hours',now()+interval '4 hours','UTC',$6,repeat('a',64),'demo_reserved',now(),now()+interval '10 minutes')",
      [
        bookingId,
        ownedProfiles[0],
        learnerId,
        parent.id,
        subject.id,
        randomUUID(),
      ],
    );
    await world.owner.pool.query(
      "INSERT INTO booking_events(booking_id,event) VALUES($1,'demo_reserved')",
      [bookingId],
    );
    const snapshot = async () =>
      (
        await world.owner.pool.query(
          "SELECT md5(row_to_json(b)::text) AS hash FROM bookings b WHERE id=$1 UNION ALL SELECT md5(row_to_json(e)::text) FROM booking_events e WHERE booking_id=$1 UNION ALL SELECT md5(row_to_json(t)::text) FROM tutor_subjects t WHERE subject_id=$2 ORDER BY hash",
          [bookingId, subject.id],
        )
      ).rows;
    const before = await snapshot();
    const corrected = `Corrected ${randomUUID()}`;
    expect((await rename(admin, subject.id, corrected)).status).toBe(200);
    expect(await snapshot()).toEqual(before);
    const filters = {
      subject: subject.slug,
      level: "college_support" as const,
    };
    const tutors = await listEligibleTutors(world.runtime.db);
    const directory = await readDirectoryAvailability(
      world.runtime,
      tutors,
      filters,
      preferences,
    );
    const matching = await readMatchingAvailability(world.runtime, tutors, {
      subjectSlug: subject.slug,
      level: "college_support",
      preferences,
    });
    expect(directory.tutors).toHaveLength(21);
    expect(directory.tutors.slice(0, 20)).toHaveLength(20);
    expect(directory.tutors.slice(20)).toHaveLength(1);
    expect(
      directory.tutors.every((t) =>
        t.offerings.some(
          (s) => s.subjectSlug === subject.slug && s.subjectName === corrected,
        ),
      ),
    ).toBe(true);
    expect(new Set(matching.matches.map((m) => m.tutor.slug))).toEqual(
      new Set(directory.tutors.map((t) => t.slug)),
    );
    await setSubjectActive(world.runtime, admin.headers, subject.id, {
      isActive: false,
    });
    const current = await listEligibleTutors(world.runtime.db);
    expect(
      (
        await readDirectoryAvailability(
          world.runtime,
          current,
          filters,
          preferences,
        )
      ).tutors,
    ).toEqual([]);
    expect(
      (
        await readMatchingAvailability(world.runtime, current, {
          subjectSlug: subject.slug,
          level: "college_support",
          preferences,
        })
      ).matches,
    ).toEqual([]);
    expect(await snapshot()).toEqual(before);
  });

  it("email completion invalidates old catalog/private sessions while preserving exact roles, guardian ownership, tutor eligibility and live notification recipient", async () => {
    const account = await createAccount(world, ["admin", "parent", "tutor"]);
    const foreign = await createAccount(world, ["parent"]);
    const oldLogin = await handleAuthRequest(
      world.runtime,
      jsonRequest(world, "/api/auth/sign-in/email", {
        body: { email: account.email, password },
      }),
    );
    const old = {
      ...account,
      cookie: cookieOf(oldLogin),
      headers: new Headers({ cookie: cookieOf(oldLogin) }),
    };
    const learnerId = await familyLearner(
      world.owner.pool,
      account.id,
      "guardian",
      "PRIVATE EMAIL COMBINED LEARNER",
    );
    const tutorId = await profile(account);
    const tutorSlug = (
      await world.owner.pool.query(
        "SELECT slug FROM tutor_profiles WHERE id=$1",
        [tutorId],
      )
    ).rows[0].slug as string;
    const math = (
      await world.owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
    ).rows[0].id as string;
    await world.owner.pool.query(
      "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) VALUES($1,$2,ARRAY['elementary','college_support'])",
      [tutorId, math],
    );
    const bookingId = await familyReservation(world.owner.pool, {
      learnerId,
      actorId: account.id,
      tutorId,
    });
    const privateUrl =
      "https://zoom.us/j/12345678901?pwd=combinedPrivateSynthetic";
    await savePrivateMeetingLink(world.runtime, account.headers, bookingId, {
      url: privateUrl,
      expectedRevision: 0,
      requestId: randomUUID(),
    });
    const subject = await createSpecializedSubject(
      world.runtime,
      account.headers,
      { name: `Email combined ${randomUUID()}` },
    );
    const eventId = (
      await world.owner.pool.query(
        "SELECT id FROM booking_events WHERE booking_id=$1 AND event='demo_reserved'",
        [bookingId],
      )
    ).rows[0].id as string;
    const pending = await prepare(account);
    const complete = await change(account, pending.body);
    expect(complete.status).toBe(200);
    const current = {
      ...account,
      cookie: cookieOf(complete),
      headers: new Headers({ cookie: cookieOf(complete) }),
    };
    expect(
      (await rename(old, subject.id, `Denied ${randomUUID()}`)).status,
    ).toBe(401);
    await expect(
      readParticipantBooking(world.runtime, old.headers, bookingId, "guardian"),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      readPrivateMeetingLink(world.runtime, old.headers, bookingId),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      listMyLearners(world.runtime, old.headers),
    ).rejects.toMatchObject({ status: 401 });
    expect(
      (await requireIdentity(world.runtime, current.headers)).roles.sort(),
    ).toEqual(["admin", "parent", "tutor"]);
    expect(
      (await listMyLearners(world.runtime, current.headers)).some(
        (l) => l.id === learnerId,
      ),
    ).toBe(true);
    expect(
      (
        await readParticipantBooking(
          world.runtime,
          current.headers,
          bookingId,
          "guardian",
        )
      ).id === bookingId,
    ).toBe(true);
    const link = await readPrivateMeetingLink(
      world.runtime,
      current.headers,
      bookingId,
    );
    expect(link.state === "present" && link.url === privateUrl).toBe(true);
    await expect(
      readPrivateMeetingLink(world.runtime, foreign.headers, bookingId),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (await rename(current, subject.id, `Allowed ${randomUUID()}`)).status,
    ).toBe(200);
    const notice = await readSimulationNoticeRecipient(world.owner.db, {
      bookingId,
      eventId,
      recipientUserId: account.id,
    });
    expect(notice?.recipientEmail === pending.newEmail).toBe(true);
    expect(
      (await listEligibleTutors(world.runtime.db)).some(
        (t) =>
          t.slug === tutorSlug &&
          t.offerings.some((s) => s.subjectSlug === "math"),
      ),
    ).toBe(true);
    expect(
      (await dispatchPendingBookingNotices(world.runtime, { eventId }))
        .captured,
    ).toBe(1);
    const captured = await readFile(
      path.join(
        bookingNoticeMailbox("test"),
        `${bookingNoticeKey(eventId, account.id)}.html`,
      ),
      "utf8",
    );
    expect(captured.includes("Math")).toBe(true);
    expect(
      [
        account.email,
        pending.newEmail,
        learnerId,
        "PRIVATE EMAIL COMBINED LEARNER",
        privateUrl,
      ].some((v) => captured.includes(v)),
    ).toBe(false);
    const publicText = JSON.stringify(
      await listEligibleTutors(world.runtime.db),
    );
    expect(
      [pending.newEmail, account.email, learnerId, bookingId, privateUrl].some(
        (v) => publicText.includes(v),
      ),
    ).toBe(false);
    expect((await change(current, pending.body)).status).toBe(400);
  });

  it("suspension and stale sessions block both email proof stages with catalog authority intact", async () => {
    const account = await createAccount(world, ["admin"]);
    const pending = await prepare(account);
    await world.owner.pool.query(
      "UPDATE user_access SET status='suspended' WHERE user_id=$1",
      [account.id],
    );
    expect((await change(account, pending.body)).status).toBe(403);
    expect((await change(account, { action: "start" })).status).toBe(403);
    await world.owner.pool.query(
      "UPDATE user_access SET status='active' WHERE user_id=$1",
      [account.id],
    );
    await world.owner.pool.query(
      "UPDATE session SET created_at=now()-interval '2 days' WHERE user_id=$1",
      [account.id],
    );
    expect((await change(account, pending.body)).status).toBe(403);
    const value = (
      await world.owner.pool.query(
        'SELECT email,email_verified FROM "user" WHERE id=$1',
        [account.id],
      )
    ).rows[0];
    expect(value.email === account.email && value.email_verified).toBe(true);
    expect(
      (await requireIdentity(world.runtime, account.headers)).roles,
    ).toEqual(["admin"]);
  });
});
