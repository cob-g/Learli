import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { composeAccountAuth } from "@/features/hosted-auth/composition";
import { captureLocalMail } from "@/lib/email/local-mail";
import { syntheticEmail } from "@/lib/local-mode";
import { googleMeetWorkerGrantsSql } from "../../scripts/google-meet-worker-grants";
import { runtimeGrantsSql } from "../../scripts/runtime-grants";
import {
  prepareLocalPolicies,
  prepareLocalStaff,
} from "../../scripts/local-workflow";
import { assertOwnedReadinessDatabase } from "../support/readiness-placement";
import {
  localIndependentAdmissionPolicy,
  localGuardianAdmissionPolicy,
} from "@/features/learner-admission/policy";
import {
  localIndependentBookingPolicy,
  localParentBookingPolicy,
} from "@/features/booking-workflows/policy";
import {
  startGoogleConnection,
  finishGoogleConnection,
  disconnectGoogleConnection,
  readGoogleConnection,
} from "@/features/google-meet/service";
import { googleMeetBoundary } from "@/features/google-meet/handler";
import { drainGoogleMeet } from "@/features/google-meet/worker";
import { GoogleFailure } from "@/features/google-meet/provider";
import { queryPrivateMeeting } from "@/features/booking-meeting-links/query";
import {
  openWorld,
  closeWorld,
  createAccount,
  jsonRequest,
  type World,
  type TestAccount,
} from "./support";
import { testMeetConfig, FakeGoogle } from "../support/google-meet";

let control: World,
  world: World,
  worker: Pool,
  tutor: TestAccount,
  student: TestAccount,
  parent: TestAccount,
  stranger: TestAccount;
let tutorId: string, learnerId: string, childId: string, subjectId: string;
let tutorSession: string, studentSession: string, parentSession: string;
let provider: FakeGoogle;
const config = testMeetConfig();
const database = `learli_meet_${randomUUID().replaceAll("-", "")}`;
let created = false,
  sequence = 0;
async function sid(account: TestAccount) {
  const session = await world.runtime.auth.api.getSession({
    headers: account.headers,
  });
  if (!session) throw new Error("Expected verified synthetic identity.");
  return session.session.id;
}
async function connect(account = tutor) {
  const start = await startGoogleConnection(
    world.runtime,
    account.headers,
    config,
    provider,
    { consent: true },
  );
  const query = new URLSearchParams({
    state: new URL(start.url).searchParams.get("state")!,
    code: "synthetic-code",
  });
  await finishGoogleConnection(
    world.runtime,
    account.headers,
    config,
    provider,
    query,
    start.browser,
  );
}
async function book(guardian = false) {
  const request = randomUUID();
  const start = new Date(
      Math.ceil(Date.now() / 3600000) * 3600000 +
        (48 + sequence++ * 2) * 3600000,
    ),
    end = new Date(start.getTime() + 3600000);
  const result = await world.runtime.pool.query(
    "SELECT * FROM public.create_policy_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,'UTC',$10)",
    [
      guardian ? parent.id : student.id,
      guardian ? parentSession : studentSession,
      request,
      guardian
        ? localParentBookingPolicy.policyId
        : localIndependentBookingPolicy.policyId,
      guardian ? childId : learnerId,
      tutorId,
      subjectId,
      start,
      end,
      "b".repeat(64),
    ],
  );
  expect(result.rows[0]?.outcome).toBe("created");
  return result.rows[0].booking_id as string;
}
async function job(id: string) {
  return (
    await world.owner.pool.query(
      "SELECT * FROM booking_meeting_provisioning WHERE booking_id=$1",
      [id],
    )
  ).rows[0];
}
async function projection(account: TestAccount, bookingId: string) {
  return queryPrivateMeeting(
    world.runtime.db,
    { userId: account.id, sessionId: await sid(account), localWorkflow: true },
    bookingId,
  );
}
async function manual(id: string) {
  const db = await world.runtime.pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE", [
      tutorId,
    ]);
    await db.query("SELECT id FROM bookings WHERE id=$1 FOR NO KEY UPDATE", [
      id,
    ]);
    await db.query(
      "INSERT INTO booking_meeting_links(booking_id,provider,url,revision,request_id,updated_by_user_id,updated_at) VALUES($1,'google_meet','https://meet.google.com/manual-link-abc',1,$2,$3,clock_timestamp())",
      [id, randomUUID(), tutor.id],
    );
    await db.query("COMMIT");
  } finally {
    await db.query("ROLLBACK");
    db.release();
  }
}
beforeAll(async () => {
  assertOwnedReadinessDatabase(process.cwd());
  control = openWorld();
  await control.owner.pool.query(
    `CREATE DATABASE ${database} OWNER learli_owner`,
  );
  created = true;
  await control.owner.pool.query(
    `REVOKE ALL ON DATABASE ${database} FROM PUBLIC; GRANT CONNECT ON DATABASE ${database} TO learli_app`,
  );
  const options = (pool: Pool) => ({
    host: pool.options.host,
    port: pool.options.port,
    user: pool.options.user,
    password: pool.options.password,
    database,
    ssl: false as const,
    max: 5,
    connectionTimeoutMillis: 3000,
  });
  const ownerPool = new Pool(options(control.owner.pool)),
    appPool = new Pool(options(control.runtime.pool));
  const db = drizzle(appPool, { schema });
  world = {
    owner: { pool: ownerPool, db: drizzle(ownerPool, { schema }) },
    runtime: {
      ...composeAccountAuth(db, {
        origin: control.runtime.origin,
        secret: process.env.BETTER_AUTH_SECRET!,
        hosted: false,
        permitsEmail: syntheticEmail,
        sendMail: (mail) => captureLocalMail("test", mail),
      }),
      db,
      pool: appPool,
      origin: control.runtime.origin,
      environment: "test",
    },
  };
  await migrate(world.owner.db, { migrationsFolder: "drizzle" });
  await ownerPool.query(runtimeGrantsSql);
  await ownerPool.query(
    "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='learli_meet_worker') THEN CREATE ROLE learli_meet_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION; END IF; END $$",
  );
  await ownerPool.query(googleMeetWorkerGrantsSql);
  worker = new Pool({
    ...options(control.owner.pool),
    options: "-c role=learli_meet_worker",
    max: 2,
  });
  expect((await worker.query("SELECT current_user AS name")).rows[0].name).toBe(
    "learli_meet_worker",
  );
  const owner = await ownerPool.connect();
  try {
    await owner.query("BEGIN");
    await prepareLocalPolicies(owner);
    await owner.query("COMMIT");
  } finally {
    await owner.query("ROLLBACK");
    owner.release();
  }
  subjectId = (
    await ownerPool.query(
      "SELECT id FROM subjects WHERE slug='math' AND category='academic_core'",
    )
  ).rows[0].id;
  tutor = await createAccount(world, ["tutor"]);
  student = await createAccount(world);
  parent = await createAccount(world, ["parent"]);
  stranger = await createAccount(world, ["student"]);
  const admin = await createAccount(world, ["admin"]),
    adminSession = await sid(admin);
  const staff = await ownerPool.connect();
  try {
    await staff.query("BEGIN");
    await prepareLocalStaff(staff, admin.id);
    await staff.query("COMMIT");
  } finally {
    await staff.query("ROLLBACK");
    staff.release();
  }
  tutorSession = await sid(tutor);
  studentSession = await sid(student);
  parentSession = await sid(parent);
  tutorId = (
    await ownerPool.query(
      "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone) VALUES($1,$2,'Synthetic tutor','Synthetic profile','Synthetic background','UTC') RETURNING id",
      [tutor.id, `meet-${randomUUID()}`],
    )
  ).rows[0].id;
  await ownerPool.query(
    "INSERT INTO tutor_subjects(tutor_id,subject_id,levels) VALUES($1,$2,ARRAY['college_support','middle_school'])",
    [tutorId, subjectId],
  );
  for (let day = 1; day <= 7; day++)
    await ownerPool.query(
      "INSERT INTO tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) VALUES($1,$2,0,1440)",
      [tutorId, day],
    );
  expect(
    (
      await world.runtime.pool.query(
        "SELECT * FROM public.request_tutor_screening($1,$2,$3,$4,'local-screening-v1')",
        [tutor.id, tutorSession, tutorId, randomUUID()],
      )
    ).rows[0].outcome,
  ).toBe("saved");
  expect(
    (
      await ownerPool.query(
        "SELECT state,policy_version FROM tutor_screening_cases WHERE tutor_id=$1",
        [tutorId],
      )
    ).rows[0],
  ).toMatchObject({ state: "pending", policy_version: "local-screening-v1" });
  expect(
    (
      await world.runtime.pool.query(
        "SELECT * FROM public.claim_local_workflow_task($1,$2,'screening',$3,$4)",
        [admin.id, adminSession, tutorId, randomUUID()],
      )
    ).rows[0].outcome,
  ).toBe("saved");
  for (const code of ["identity", "eligibility"]) {
    const revision = (
      await ownerPool.query(
        "SELECT revision FROM tutor_screening_cases WHERE tutor_id=$1",
        [tutorId],
      )
    ).rows[0].revision;
    expect(
      (
        await world.runtime.pool.query(
          "SELECT * FROM public.record_tutor_screening_check($1,$2,$3,$4,$5,$6,'passed',$7,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 day')",
          [
            admin.id,
            adminSession,
            tutorId,
            revision,
            randomUUID(),
            code,
            `screening:${randomUUID()}`,
          ],
        )
      ).rows[0].outcome,
    ).toBe("saved");
  }
  const revision = (
    await ownerPool.query(
      "SELECT revision FROM tutor_screening_cases WHERE tutor_id=$1",
      [tutorId],
    )
  ).rows[0].revision;
  expect(
    (
      await world.runtime.pool.query(
        "SELECT * FROM public.decide_tutor_screening($1,$2,$3,$4,$5,'approve')",
        [admin.id, adminSession, tutorId, revision, randomUUID()],
      )
    ).rows[0].outcome,
  ).toBe("saved");
  const self = await world.runtime.pool.query(
    "SELECT * FROM public.create_independent_learner($1,$2,$3,$4,$5,'Synthetic independent learner','UTC',NULL,true)",
    [
      student.id,
      studentSession,
      randomUUID(),
      localIndependentAdmissionPolicy.policyId,
      localIndependentAdmissionPolicy.noticeVersion,
    ],
  );
  expect(self.rows[0].outcome).toBe("created");
  learnerId = self.rows[0].learner_id;
  const child = await world.runtime.pool.query(
    "SELECT * FROM public.create_parent_child($1,$2,$3,$4,$5,'Synthetic child','middle_school',8,'UTC',NULL,true,true)",
    [
      parent.id,
      parentSession,
      randomUUID(),
      localGuardianAdmissionPolicy.policyId,
      localGuardianAdmissionPolicy.noticeVersion,
    ],
  );
  expect(child.rows[0].outcome).toBe("created");
  childId = child.rows[0].learner_id;
}, 60000);
beforeEach(async () => {
  provider = new FakeGoogle();
  student = await createAccount(world);
  studentSession = await sid(student);
  const fresh = await world.runtime.pool.query(
    "SELECT * FROM public.create_independent_learner($1,$2,$3,$4,$5,'Synthetic isolated learner','UTC',NULL,true)",
    [
      student.id,
      studentSession,
      randomUUID(),
      localIndependentAdmissionPolicy.policyId,
      localIndependentAdmissionPolicy.noticeVersion,
    ],
  );
  expect(fresh.rows[0].outcome).toBe("created");
  learnerId = fresh.rows[0].learner_id;
  // Disposable owned database only; keep booking/history rows while isolating jobs.
  await world.owner.pool.query(
    "UPDATE booking_meeting_provisioning SET state='blocked',claim_until=NULL WHERE state IN('pending','claimed','dispatched')",
  );
  await world.owner.pool.query("DELETE FROM google_meet_oauth_attempts");
  await connect();
});
afterAll(async () => {
  await worker?.end();
  await closeWorld(world);
  if (created) await control.owner.pool.query(`DROP DATABASE ${database}`);
  await closeWorld(control);
});

describe("Google connection and private PostgreSQL provisioning", () => {
  it.each([false, true])(
    "retains a rejected job without replay when diagnostic reporting throws=%s",
    async (throws) => {
      const id = await book();
      const diagnostics: unknown[] = [];
      provider.createSpace = async () => {
        provider.calls++;
        throw new GoogleFailure("create_rejected", {
          httpStatus: 403,
          status: "PERMISSION_DENIED",
          reason: "SERVICE_DISABLED",
        });
      };
      await drainGoogleMeet(worker, config, provider, 1, (diagnostic) => {
        diagnostics.push(diagnostic);
        if (throws) throw new Error("synthetic reporting failure");
      });
      expect(diagnostics).toEqual([
        {
          httpStatus: 403,
          status: "PERMISSION_DENIED",
          reason: "SERVICE_DISABLED",
        },
      ]);
      expect(await job(id)).toMatchObject({
        state: "blocked",
        failure_code: "create_rejected",
        attempts: 1,
        space_name: null,
      });
      await drainGoogleMeet(worker, config, provider, 1);
      expect(provider.calls).toBe(1);
      expect(
        (
          await world.owner.pool.query(
            "SELECT state FROM bookings WHERE id=$1",
            [id],
          )
        ).rows[0].state,
      ).toBe("confirmed");
      expect(
        (
          await world.owner.pool.query(
            "SELECT 1 FROM booking_meeting_links WHERE booking_id=$1",
            [id],
          )
        ).rowCount,
      ).toBe(0);
    },
  );
  it("binds consent to the owner, encrypts tokens and denies general app/worker credential reads", async () => {
    expect(
      await readGoogleConnection(world.runtime, tutor.headers),
    ).toMatchObject({ state: "active", account_label: "host@learli.test" });
    await expect(
      readGoogleConnection(world.runtime, student.headers),
    ).rejects.toMatchObject({ status: 403 });
    const stored = (
      await world.owner.pool.query(
        "SELECT refresh_ciphertext FROM tutor_google_meet_connections WHERE user_id=$1",
        [tutor.id],
      )
    ).rows[0];
    expect(stored.refresh_ciphertext).not.toContain(
      provider.grant.refreshToken,
    );
    for (const pool of [world.runtime.pool, worker])
      await expect(
        pool.query(
          "SELECT refresh_ciphertext FROM tutor_google_meet_connections",
        ),
      ).rejects.toMatchObject({ code: "42501" });
    await expect(worker.query("SELECT * FROM bookings")).rejects.toMatchObject({
      code: "42501",
    });
    expect(
      (
        await world.owner.pool.query(
          "SELECT action FROM audit_events WHERE target_user_id=$1 ORDER BY created_at DESC",
          [tutor.id],
        )
      ).rows[0].action,
    ).toBe("google_meet.connected");
  });
  it("rejects callback replay, wrong browser, wrong session and duplicate parameters before exchange", async () => {
    const start = await startGoogleConnection(
      world.runtime,
      tutor.headers,
      config,
      provider,
      { consent: true },
    );
    const query = new URLSearchParams({
      state: new URL(start.url).searchParams.get("state")!,
      code: "fake-code",
    });
    await expect(
      finishGoogleConnection(
        world.runtime,
        tutor.headers,
        config,
        provider,
        query,
        "a".repeat(43),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      finishGoogleConnection(
        world.runtime,
        parent.headers,
        config,
        provider,
        query,
        start.browser,
      ),
    ).rejects.toMatchObject({ status: 403 });
    const duplicate = new URLSearchParams(query);
    duplicate.append("state", query.get("state")!);
    await expect(
      finishGoogleConnection(
        world.runtime,
        tutor.headers,
        config,
        provider,
        duplicate,
        start.browser,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      await finishGoogleConnection(
        world.runtime,
        tutor.headers,
        config,
        provider,
        query,
        start.browser,
      ),
    ).toBe("connected");
    await expect(
      finishGoogleConnection(
        world.runtime,
        tutor.headers,
        config,
        provider,
        query,
        start.browser,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("accepts Google's issuer response while rejecting wrong, duplicate and unexpected callback parameters before exchange", async () => {
    const start = await startGoogleConnection(
      world.runtime,
      tutor.headers,
      config,
      provider,
      { consent: true },
    );
    const query = new URLSearchParams({
      state: new URL(start.url).searchParams.get("state")!,
      code: "synthetic-code",
      iss: "https://accounts.google.com",
    });
    let exchanges = 0;
    provider.beforeExchange = async () => {
      exchanges++;
    };
    for (const issuer of [
      "",
      "https://evil.test",
      "https://accounts.google.com/",
      "https://accounts.google.com.evil.test",
    ]) {
      const invalid = new URLSearchParams(query);
      invalid.set("iss", issuer);
      await expect(
        finishGoogleConnection(
          world.runtime,
          tutor.headers,
          config,
          provider,
          invalid,
          start.browser,
        ),
      ).rejects.toMatchObject({ status: 400 });
    }
    for (const key of ["iss", "unrecognized"]) {
      const invalid = new URLSearchParams(query);
      invalid.append(key, "https://accounts.google.com");
      await expect(
        finishGoogleConnection(
          world.runtime,
          tutor.headers,
          config,
          provider,
          invalid,
          start.browser,
        ),
      ).rejects.toMatchObject({ status: 400 });
    }
    expect(exchanges).toBe(0);
    await expect(
      finishGoogleConnection(
        world.runtime,
        tutor.headers,
        config,
        provider,
        query,
        start.browser,
      ),
    ).resolves.toBe("connected");
    expect(exchanges).toBe(1);
    expect(
      await readGoogleConnection(world.runtime, tutor.headers),
    ).toMatchObject({ state: "active" });
  });
  it("does not resurrect a connection disconnected during exchange", async () => {
    const start = await startGoogleConnection(
      world.runtime,
      tutor.headers,
      config,
      provider,
      { consent: true },
    );
    provider.beforeExchange = async () => {
      await disconnectGoogleConnection(
        world.runtime,
        tutor.headers,
        null,
        null,
      );
    };
    await expect(
      finishGoogleConnection(
        world.runtime,
        tutor.headers,
        config,
        provider,
        new URLSearchParams({
          state: new URL(start.url).searchParams.get("state")!,
          code: "fake",
        }),
        start.browser,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await readGoogleConnection(world.runtime, tutor.headers))?.state,
    ).toBe("disconnected");
  });
  it("preserves omitted refresh tokens only for the same Google identity; replacement requires consent", async () => {
    provider.grant.refreshToken = null;
    await connect();
    const id = await book();
    expect((await drainGoogleMeet(worker, config, provider, 1)).ready).toBe(1);
    expect((await job(id)).state).toBe("ready");
    provider.grant = {
      ...provider.grant,
      subject: "different-subject",
      refreshToken: "different-synthetic-token",
    };
    await expect(connect()).rejects.toMatchObject({ status: 409 });
  });
  it("atomically enqueues confirmed no-money bookings; both participant projections share one saved link", async () => {
    const id = await book(),
      own = await book(true);
    expect((await job(id)).state).toBe("pending");
    expect((await job(own)).state).toBe("pending");
    expect(
      (
        await world.runtime.pool.query(
          "SELECT public.google_meet_job_status($1,$2,$3,$4) AS state",
          [student.id, studentSession, id, config.fingerprint],
        )
      ).rows[0].state,
    ).toBe("preparing");
    expect(
      (
        await world.runtime.pool.query(
          "SELECT public.google_meet_job_status($1,$2,$3,$4) AS state",
          [parent.id, parentSession, id, config.fingerprint],
        )
      ).rows[0].state,
    ).toBeNull();
    const counts = await drainGoogleMeet(worker, config, provider);
    expect(counts.ready).toBe(2);
    expect(provider.calls).toBe(2);
    expect(await projection(student, id)).toMatchObject({
      live: true,
      url: (await projection(tutor, id))?.url,
      revision: 1,
    });
    expect((await projection(parent, own))?.url).toBe(
      (await projection(tutor, own))?.url,
    );
    expect(await projection(stranger, id)).toBeUndefined();
    expect(await projection(student, own)).toBeUndefined();
    const events = await world.owner.pool.query(
      "SELECT actor_kind,actor_user_id,automation_job_id FROM booking_meeting_link_events WHERE booking_id=$1",
      [id],
    );
    expect(events.rows).toEqual([
      {
        actor_kind: "system",
        actor_user_id: null,
        automation_job_id: (await job(id)).id,
      },
    ]);
    expect(
      (
        await world.owner.pool.query("SELECT state FROM bookings WHERE id=$1", [
          id,
        ])
      ).rows[0].state,
    ).toBe("confirmed");
    expect((await drainGoogleMeet(worker, config, provider)).claimed).toBe(0);
    expect(provider.calls).toBe(2);
  });
  it("two competing workers create one space and one link for the same booking", async () => {
    const id = await book();
    const outcomes = await Promise.all([
      drainGoogleMeet(worker, config, provider, 1),
      drainGoogleMeet(worker, config, provider, 1),
    ]);
    expect(outcomes.reduce((sum, outcome) => sum + outcome.ready, 0)).toBe(1);
    expect(provider.calls).toBe(1);
    expect((await job(id)).state).toBe("ready");
  });
  it("manual link saved during create wins, retaining only its authoritative revision", async () => {
    const id = await book();
    provider.beforeCreate = () => manual(id);
    expect((await drainGoogleMeet(worker, config, provider, 1)).ready).toBe(0);
    expect((await job(id)).state).toBe("suppressed");
    expect((await projection(tutor, id))?.url).toBe(
      "https://meet.google.com/manual-link-abc",
    );
  });
  it("disconnect during create fences installation without cancelling the booking", async () => {
    const id = await book();
    provider.beforeCreate = async () => {
      await disconnectGoogleConnection(
        world.runtime,
        tutor.headers,
        config,
        provider,
      );
    };
    expect((await drainGoogleMeet(worker, config, provider, 1)).ready).toBe(0);
    expect((await job(id)).state).toBe("suppressed");
    expect((await projection(student, id))?.url).toBeNull();
    expect(provider.revocations).toBe(1);
  });
  it("cancellation during creation suppresses the late result and retains history", async () => {
    const id = await book();
    provider.beforeCreate = async () => {
      const result = await world.runtime.pool.query(
        "SELECT * FROM public.change_policy_booking($1,$2,$3,$4,$5,0,'cancel','local_participant_change',NULL,NULL,NULL,$6)",
        [
          student.id,
          studentSession,
          id,
          randomUUID(),
          localIndependentBookingPolicy.policyId,
          "c".repeat(64),
        ],
      );
      expect(result.rows[0].outcome).toBe("saved");
    };
    expect((await drainGoogleMeet(worker, config, provider, 1)).ready).toBe(0);
    expect((await job(id)).state).toBe("suppressed");
    expect((await projection(student, id))?.live).toBe(false);
    expect(
      (
        await world.owner.pool.query(
          "SELECT count(*)::int AS count FROM booking_lifecycle_events WHERE booking_id=$1",
          [id],
        )
      ).rows[0].count,
    ).toBe(2);
  });
  it("an uncertain create is never replayed, even when the worker drains again", async () => {
    const id = await book();
    provider.beforeCreate = async () => {
      throw new GoogleFailure("uncertain");
    };
    await drainGoogleMeet(worker, config, provider, 1);
    expect((await job(id)).state).toBe("uncertain");
    await drainGoogleMeet(worker, config, provider);
    expect(provider.calls).toBe(1);
    expect(
      (
        await world.owner.pool.query("SELECT state FROM bookings WHERE id=$1", [
          id,
        ])
      ).rows[0].state,
    ).toBe("confirmed");
  });
  it("known receipt recovers after lease expiry without another Google create", async () => {
    const id = await book(),
      token = randomUUID();
    const claim = (
      await worker.query("SELECT * FROM public.google_meet_claim($1,$2)", [
        config.fingerprint,
        token,
      ])
    ).rows[0];
    await worker.query(
      "SELECT * FROM public.google_meet_prepare($1,$2,$3,true)",
      [claim.id, token, config.fingerprint],
    );
    await worker.query(
      "SELECT public.google_meet_receipt($1,$2,'spaces/known','https://meet.google.com/known-link-abc')",
      [claim.id, token],
    );
    await world.owner.pool.query(
      "UPDATE booking_meeting_provisioning SET claim_until=clock_timestamp()-interval '1 second' WHERE booking_id=$1",
      [id],
    );
    await world.owner.pool.query(
      "UPDATE tutor_google_meet_connections SET busy_until=clock_timestamp()-interval '1 second' WHERE user_id=$1",
      [tutor.id],
    );
    expect((await drainGoogleMeet(worker, config, provider, 1)).ready).toBe(1);
    expect(provider.calls).toBe(0);
    expect(provider.refreshes).toBe(0);
  });
  it("unknown dispatched work becomes uncertain, while pre-dispatch work can be reclaimed", async () => {
    const id = await book(),
      token = randomUUID(),
      claimed = (
        await worker.query("SELECT * FROM public.google_meet_claim($1,$2)", [
          config.fingerprint,
          token,
        ])
      ).rows[0];
    await worker.query(
      "SELECT * FROM public.google_meet_prepare($1,$2,$3,true)",
      [claimed.id, token, config.fingerprint],
    );
    await world.owner.pool.query(
      "UPDATE booking_meeting_provisioning SET claim_until=clock_timestamp()-interval '1 second' WHERE booking_id=$1",
      [id],
    );
    await world.owner.pool.query(
      "UPDATE tutor_google_meet_connections SET busy_until=clock_timestamp()-interval '1 second' WHERE user_id=$1",
      [tutor.id],
    );
    await drainGoogleMeet(worker, config, provider, 1);
    expect((await job(id)).state).toBe("uncertain");
    expect(provider.calls).toBe(0);
    const other = await book(),
      token2 = randomUUID();
    await worker.query("SELECT * FROM public.google_meet_claim($1,$2)", [
      config.fingerprint,
      token2,
    ]);
    await world.owner.pool.query(
      "UPDATE booking_meeting_provisioning SET claim_until=clock_timestamp()-interval '1 second' WHERE booking_id=$1",
      [other],
    );
    expect((await drainGoogleMeet(worker, config, provider, 1)).ready).toBe(1);
    expect(provider.calls).toBe(1);
  });
  it("revoked refresh grants require reconnection; plain transient refresh errors remain bounded", async () => {
    const id = await book();
    provider.beforeRefresh = async () => {
      throw new GoogleFailure("refresh_rejected");
    };
    await drainGoogleMeet(worker, config, provider, 1);
    expect(provider.calls).toBe(0);
    expect((await job(id)).state).toBe("blocked");
    expect(
      (await readGoogleConnection(world.runtime, tutor.headers))?.state,
    ).toBe("reconnect");
  });
  it("connection applies prospectively and does not backfill existing confirmed bookings", async () => {
    await disconnectGoogleConnection(world.runtime, tutor.headers, null, null);
    const id = await book();
    expect(await job(id)).toBeUndefined();
    await connect();
    expect(await job(id)).toBeUndefined();
  });
  it("callback HTTP responses clear private query state and are never publicly cached", async () => {
    const started = await googleMeetBoundary(
      world.runtime,
      jsonRequest(world, "/api/tutor/meeting-providers/google/connect", {
        cookie: tutor.cookie,
        body: { consent: true },
      }),
      "connect",
      config,
      provider,
    );
    expect(started.status).toBe(200);
    const url = (await started.json()).url;
    const cookie = started.headers.get("set-cookie")!.split(";", 1)[0];
    const callback = new Request(
      `${world.runtime.origin}/api/tutor/meeting-providers/google/callback?${new URLSearchParams({ state: new URL(url).searchParams.get("state")!, code: "fake-code" })}`,
      { headers: { cookie: `${tutor.cookie}; ${cookie}` } },
    );
    const response = await googleMeetBoundary(
      world.runtime,
      callback,
      "callback",
      config,
      provider,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `${world.runtime.origin}/tutor/meetings?result=connected`,
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    const forbidden = await googleMeetBoundary(
      world.runtime,
      jsonRequest(world, "/api/tutor/meeting-providers/google/connect", {
        cookie: tutor.cookie,
        origin: "https://evil.test",
        body: { consent: true },
      }),
      "connect",
      config,
      provider,
    );
    expect(forbidden.status).toBe(403);
  });
  it("reschedules one confirmed record into one replacement intent without copying its old link", async () => {
    const id = await book();
    await drainGoogleMeet(worker, config, provider, 1);
    const target = new Date(
      Math.ceil(Date.now() / 3600000) * 3600000 +
        (48 + sequence++ * 2) * 3600000,
    );
    const result = await world.runtime.pool.query(
      "SELECT * FROM public.change_policy_booking($1,$2,$3,$4,$5,0,'reschedule','local_participant_change',$6,$7,'UTC',$8)",
      [
        student.id,
        studentSession,
        id,
        randomUUID(),
        localIndependentBookingPolicy.policyId,
        target,
        new Date(target.getTime() + 3600000),
        "d".repeat(64),
      ],
    );
    expect(result.rows[0].outcome).toBe("saved");
    const replacement = result.rows[0].booking_id;
    expect(replacement).not.toBe(id);
    expect((await job(replacement)).state).toBe("pending");
    expect((await projection(student, id))?.live).toBe(false);
    expect((await projection(student, replacement))?.url).toBeNull();
    await drainGoogleMeet(worker, config, provider, 1);
    expect(provider.calls).toBe(2);
    expect((await projection(student, replacement))?.url).not.toBe(
      (await job(id)).meeting_uri,
    );
    expect(
      (
        await world.owner.pool.query(
          "SELECT count(*)::int AS n FROM booking_meeting_provisioning WHERE booking_id=$1",
          [replacement],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("a late known receipt can recover an uncertain attempt without another create", async () => {
    const id = await book(),
      token = randomUUID();
    const claimed = (
      await worker.query("SELECT * FROM public.google_meet_claim($1,$2)", [
        config.fingerprint,
        token,
      ])
    ).rows[0];
    await worker.query(
      "SELECT * FROM public.google_meet_prepare($1,$2,$3,true)",
      [claimed.id, token, config.fingerprint],
    );
    await worker.query("SELECT public.google_meet_fail($1,$2,'uncertain')", [
      claimed.id,
      token,
    ]);
    expect((await job(id)).state).toBe("uncertain");
    await worker.query(
      "SELECT public.google_meet_receipt($1,$2,'spaces/late','https://meet.google.com/late-link-abc')",
      [claimed.id, token],
    );
    // Simulate the bounded retry delay elapsing, without a real sleep.
    await world.owner.pool.query(
      "UPDATE booking_meeting_provisioning SET next_attempt_at=clock_timestamp() WHERE booking_id=$1",
      [id],
    );
    expect((await drainGoogleMeet(worker, config, provider, 1)).ready).toBe(1);
    expect(provider.calls).toBe(0);
  });
  it("current learner account restriction during HTTP prevents publication", async () => {
    const id = await book();
    provider.beforeCreate = async () => {
      await world.owner.pool.query(
        "UPDATE user_access SET status='suspended' WHERE user_id=$1",
        [student.id],
      );
    };
    try {
      await drainGoogleMeet(worker, config, provider, 1);
      expect((await job(id)).state).toBe("suppressed");
      expect(
        (
          await world.owner.pool.query(
            "SELECT count(*)::int AS n FROM booking_meeting_links WHERE booking_id=$1",
            [id],
          )
        ).rows[0].n,
      ).toBe(0);
    } finally {
      await world.owner.pool.query(
        "UPDATE user_access SET status='active' WHERE user_id=$1",
        [student.id],
      );
    }
  });
  it("manual replacement of an automatic link restores human provenance and preserves the system event", async () => {
    const id = await book();
    await drainGoogleMeet(worker, config, provider, 1);
    await world.runtime.pool.query(
      "UPDATE booking_meeting_links SET url='https://meet.google.com/manual-link-abc',revision=2,request_id=$2,updated_by_user_id=$3,updated_at=clock_timestamp() WHERE booking_id=$1",
      [id, randomUUID(), tutor.id],
    );
    const row = (
      await world.owner.pool.query(
        "SELECT actor_kind,automation_job_id,updated_by_user_id FROM booking_meeting_links WHERE booking_id=$1",
        [id],
      )
    ).rows[0];
    expect(row).toEqual({
      actor_kind: "human",
      automation_job_id: null,
      updated_by_user_id: tutor.id,
    });
    expect(
      (
        await world.owner.pool.query(
          "SELECT actor_kind FROM booking_meeting_link_events WHERE booking_id=$1",
          [id],
        )
      ).rows[0].actor_kind,
    ).toBe("system");
  });
  it("expired consent attempts and stale sessions cannot reconnect", async () => {
    const start = await startGoogleConnection(
      world.runtime,
      tutor.headers,
      config,
      provider,
      { consent: true },
    );
    await world.owner.pool.query(
      "UPDATE google_meet_oauth_attempts SET expires_at=clock_timestamp()-interval '1 second',created_at=clock_timestamp()-interval '1 minute'",
    );
    await expect(
      finishGoogleConnection(
        world.runtime,
        tutor.headers,
        config,
        provider,
        new URLSearchParams({
          state: new URL(start.url).searchParams.get("state")!,
          code: "fake",
        }),
        start.browser,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await world.owner.pool.query(
      "UPDATE session SET created_at=clock_timestamp()-interval '2 days' WHERE id=$1",
      [tutorSession],
    );
    try {
      await expect(
        startGoogleConnection(world.runtime, tutor.headers, config, provider, {
          consent: true,
        }),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      await world.owner.pool.query(
        "UPDATE session SET created_at=clock_timestamp() WHERE id=$1",
        [tutorSession],
      );
    }
  });
  it("rolls back booking and meeting intent together when confirmation does not commit", async () => {
    const client = await world.runtime.pool.connect(),
      key = randomUUID();
    const target = new Date(
      Math.ceil(Date.now() / 3600000) * 3600000 +
        (48 + sequence++ * 2) * 3600000,
    );
    let id: string;
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "SELECT * FROM public.create_policy_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,'UTC',$10)",
        [
          student.id,
          studentSession,
          key,
          localIndependentBookingPolicy.policyId,
          learnerId,
          tutorId,
          subjectId,
          target,
          new Date(target.getTime() + 3600000),
          "e".repeat(64),
        ],
      );
      expect(result.rows[0].outcome).toBe("created");
      id = result.rows[0].booking_id;
      await client.query("ROLLBACK");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    expect(
      (
        await world.owner.pool.query(
          "SELECT count(*)::int AS n FROM bookings WHERE idempotency_key=$1",
          [key],
        )
      ).rows[0].n,
    ).toBe(0);
    expect(await job(id!)).toBeUndefined();
  });
  it("does not allow the application to forge a system actor or use worker functions", async () => {
    const id = await book(),
      j = await job(id);
    await expect(
      world.runtime.pool.query(
        "SELECT * FROM public.google_meet_claim($1,$2)",
        [config.fingerprint, randomUUID()],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      world.runtime.pool.query(
        "INSERT INTO booking_meeting_links(booking_id,provider,url,revision,request_id,updated_at,actor_kind,automation_job_id) VALUES($1,'google_meet','https://meet.google.com/fake-link-abc',1,$2,clock_timestamp(),'system',$2)",
        [id, j.id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      (
        await world.owner.pool.query(
          "SELECT count(*)::int AS n FROM booking_meeting_links WHERE booking_id=$1",
          [id],
        )
      ).rows[0].n,
    ).toBe(0);
  });
});
