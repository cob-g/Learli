import { randomUUID } from "node:crypto";
import {
  readFileSync,
  readdirSync,
  realpathSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { createLocalAuth } from "@/lib/auth-factory";
import { createDatabase } from "@/lib/db/connection";
import { handleAuthRequest } from "@/lib/auth-handler";
import {
  prepareLocalPolicies,
  prepareLocalStaff,
} from "../../scripts/local-workflow";
import { enrollTestAdmin } from "../support/admin-mfa";
import { enrollParentWorkspace } from "@/features/parent-onboarding/service";
import {
  readParentChildIntake,
  createParentChild,
} from "@/features/parent-children/service";
import {
  startTutorApplication,
  saveOwnTutorProfile,
  readOwnTutorProfile,
} from "@/features/tutors/service";
import { getScreeningContext } from "@/features/tutor-screening/composition";
import {
  requestScreening,
  readScreening,
  recordScreeningCheck,
  decideScreening,
} from "@/features/tutor-screening/service";
import { localScreeningPolicy } from "@/features/tutor-screening/policy";
import {
  readOwnAvailability,
  saveOwnAvailability,
} from "@/features/availability/service";
import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import {
  readWorkflowCandidates,
  readWorkflowMoveCandidates,
  createPolicyReservation,
  changePolicyBooking,
} from "@/features/booking-workflows/service";
import { bindLocalTransactionalDelivery } from "@/features/transactional-delivery/context";
import { drainTransactionalDeliveries } from "@/features/transactional-delivery/drain";
import { drainLocalBookingNotices } from "@/features/transactional-delivery/local";
import { reconcileLocalBookingExpiry } from "@/features/transactional-delivery/expiry";
import { admissionContext } from "@/features/learner-admission/context";
import {
  createAdmission,
  readAssignedAdmission,
  mutateAdmissionReview,
} from "@/features/learner-admission/service";
import {
  localBookingPolicy,
  localParentBookingPolicy,
} from "@/features/booking-workflows/policy";
import { localGuardianAdmissionPolicy } from "@/features/learner-admission/policy";
import { sql } from "drizzle-orm";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));
const root = path.resolve(".local/booking-notice-tests");
const password = `Synthetic-booking-notice-${randomUUID()}`;
let runtime: ReturnType<typeof createLocalAuth>,
  owner: ReturnType<typeof createDatabase>;
type Actor = { id: string; email: string; cookie: string; headers: Headers };
let admin: Actor,
  parent: Actor,
  tutor: Actor,
  choice: {
    learnerId: string;
    tutorSlug: string;
    subjectSlug: string;
    displayTimezone: string;
  };
let context: ReturnType<typeof bookingWorkflowContext>;
let historicalLearnerId: string;
let requests: { body: string; key: string | null }[] = [];
let mode: "accepted" | "429" | "lost" = "accepted";
function post(route: string, body: object, cookie = "") {
  return new Request(`${runtime.origin}/api/auth/${route}`, {
    method: "POST",
    headers: {
      origin: runtime.origin,
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify(body),
  });
}
async function actor(name: string): Promise<Actor> {
  const email = `booking-notice-${randomUUID()}@example.invalid`;
  const registered = await handleAuthRequest(
    runtime,
    post("sign-up/email", { name, email, password, callbackURL: "/sign-in" }),
  );
  expect(registered.status).toBe(200);
  const id = (await registered.json()).user.id as string;
  const directory = path.join(root, ".local/mail/development");
  const proof = readdirSync(directory)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(directory, f), "utf8")))
    .find((m) => m.to === email && m.kind === "verification");
  expect(proof).toBeDefined();
  await handleAuthRequest(runtime, new Request(proof.url));
  const signed = await handleAuthRequest(
    runtime,
    post("sign-in/email", { email, password }),
  );
  expect(signed.status).toBe(200);
  const cookie = signed.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  return { id, email, cookie, headers: new Headers({ cookie }) };
}
beforeAll(async () => {
  // Explicit independently owned fixture, never the operator's ordinary database.
  if (
    process.env.LEARLI_BOOKING_NOTICE_FIXTURE !== root ||
    realpathSync(root) !== root
  )
    throw Error("Separate booking-notice fixture required.");
  const source = parseEnv(readFileSync(path.join(root, ".env.local"), "utf8"));
  if (!source.DATABASE_URL || !source.DATABASE_URL_DIRECT)
    throw Error("Private fixture connections required.");
  const selected = new URL(source.DATABASE_URL);
  const direct = new URL(source.DATABASE_URL_DIRECT);
  const state = JSON.parse(
    readFileSync(path.join(root, ".local/database.json"), "utf8"),
  );
  expect([
    selected.hostname,
    selected.port,
    selected.pathname,
    selected.username,
  ]).toEqual(["127.0.0.1", "55439", "/learli_dev", "learli_app"]);
  expect([
    direct.hostname,
    direct.port,
    direct.pathname,
    direct.username,
  ]).toEqual(["127.0.0.1", "55439", "/learli_dev", "learli_owner"]);
  expect(state.ports.database).toBe(55439);
  expect(selected.password === state.appPassword).toBe(true);
  expect(direct.password === state.ownerPassword).toBe(true);
  expect(existsSync(path.join(root, ".local/postgres/learli-owned"))).toBe(
    true,
  );
  owner = createDatabase(source.DATABASE_URL_DIRECT);
  const data = await owner.pool.query("SHOW data_directory");
  expect(realpathSync(data.rows[0].data_directory)).toBe(
    realpathSync(path.join(root, ".local/postgres/data")),
  );
  const config = {
    ...source,
    DATABASE_URL_DIRECT: undefined,
    LOCAL_WORKFLOW_MODE: "enabled",
    LOCAL_VERIFICATION_RESEND_KEY: undefined,
    LOCAL_VERIFICATION_RECIPIENT: undefined,
  };
  for (const [key, value] of Object.entries(config)) vi.stubEnv(key, value);
  vi.stubEnv("DATABASE_MODE", "local");
  vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
  vi.stubEnv("NEON_DEVELOPMENT_CONFIG_FILE", undefined);
  // Capture is private to this fixture; brand asset reads use the repository.
  const mail = await import("@/lib/email/local-mail");
  const original = mail.captureOperationalMail;
  vi.spyOn(mail, "captureOperationalMail").mockImplementation((cap, message) =>
    original(cap, message, root),
  );
  runtime = createLocalAuth({ ...config, DATABASE_MODE: "local" });
  const client = await owner.pool.connect();
  try {
    await client.query("BEGIN");
    await prepareLocalPolicies(client);
    await client.query("COMMIT");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  admin = await actor("Synthetic booking notice reviewer");
  parent = await actor("Synthetic booking notice parent");
  tutor = await actor("Synthetic booking notice tutor");
  await owner.pool.query(
    "UPDATE \"user\" SET timezone='Asia/Manila' WHERE id=$1",
    [parent.id],
  );
  const staff = await owner.pool.connect();
  try {
    await staff.query("BEGIN");
    await prepareLocalStaff(staff, admin.id);
    await staff.query("COMMIT");
  } finally {
    await staff.query("ROLLBACK");
    staff.release();
  }
  admin.cookie = await enrollTestAdmin(runtime, admin.cookie, password);
  admin.headers = new Headers({ cookie: admin.cookie });
  await enrollParentWorkspace(runtime, parent.headers, {});
  const intake = await readParentChildIntake(runtime, parent.headers);
  if (!intake.enabled) throw Error("Synthetic parent policy unavailable.");
  const learner = await createParentChild(runtime, parent.headers, {
    requestId: randomUUID(),
    displayName: "Synthetic child",
    level: "middle_school",
    grade: 8,
    timezone: "Asia/Manila",
    policyVersion: intake.policyVersion,
    policyDigest: intake.policyDigest,
    noticeVersion: intake.noticeVersion,
    guardianConfirmed: true,
    consentConfirmed: true,
  });
  await startTutorApplication(runtime, tutor.headers, {});
  const subject = (
    await owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
  ).rows[0].id as string;
  await saveOwnTutorProfile(runtime, tutor.headers, {
    headline: "Synthetic notice tutor",
    bio: "Isolated booking email fixture.",
    teachingBackground: "Synthetic fixture only.",
    timezone: "Asia/Manila",
    offerings: [{ subjectId: subject, levels: ["middle_school"] }],
  });
  const profile = await readOwnTutorProfile(runtime, tutor.headers);
  if (!profile) throw Error("Synthetic tutor missing.");
  const screening = getScreeningContext(runtime);
  await requestScreening(screening, tutor.headers, profile.id, {
    requestKey: randomUUID(),
  });
  const identity = await runtime.auth.api.getSession({
    headers: admin.headers,
  });
  if (!identity) throw Error("Synthetic reviewer session missing.");
  await runtime.db.execute(
    sql`SELECT * FROM public.claim_local_workflow_task(${admin.id},${identity.session.id},'screening',${profile.id},${randomUUID()}::uuid)`,
  );
  for (const code of localScreeningPolicy.requiredCheckCodes) {
    const current = await readScreening(screening, admin.headers, profile.id);
    if (!current) throw Error("Synthetic review missing.");
    await recordScreeningCheck(screening, admin.headers, profile.id, {
      revision: current.revision,
      requestKey: randomUUID(),
      code,
      outcome: "passed",
      reference: `screening:${randomUUID()}`,
      checkedAt: new Date(Date.now() - 60000).toISOString(),
      expiresAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    });
  }
  const screened = await readScreening(screening, admin.headers, profile.id);
  if (!screened) throw Error("Synthetic review missing.");
  await decideScreening(screening, admin.headers, profile.id, {
    revision: screened.revision,
    requestKey: randomUUID(),
    action: "approve",
  });
  const availability = await readOwnAvailability(runtime, tutor.headers);
  if (!availability) throw Error("Synthetic availability missing.");
  await saveOwnAvailability(runtime, tutor.headers, {
    version: availability.version,
    timezone: "Asia/Manila",
    windows: [1, 2, 3, 4, 5, 6, 7].map((isoWeekday) => ({
      isoWeekday,
      startMinute: 0,
      endMinute: 1440,
    })),
  });
  context = bookingWorkflowContext(runtime);
  choice = {
    learnerId: learner.id,
    tutorSlug: profile.slug,
    subjectSlug: "math",
    displayTimezone: "Asia/Manila",
  };
  vi.stubEnv("LOCAL_VERIFICATION_RESEND_KEY", "re_synthetic123456");
  vi.stubEnv("LOCAL_VERIFICATION_RECIPIENT", parent.email);
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe("https://api.resend.com/emails");
      requests.push({
        body: String(init?.body),
        key: new Headers(init?.headers).get("Idempotency-Key"),
      });
      if (mode === "lost")
        throw Error("Synthetic response lost after possible acceptance");
      return mode === "429"
        ? Response.json(
            { name: "rate_limit_exceeded", message: "private provider detail" },
            { status: 429 },
          )
        : Response.json({ id: "00000000-0000-4000-8000-000000000000" });
    }),
  );
  writeFileSync(
    path.join(root, "browser-fixture.json"),
    JSON.stringify({
      parentCookie: parent.cookie,
      parentEmail: parent.email,
      tutorCookie: tutor.cookie,
      adminCookie: admin.cookie,
      choice,
    }),
    { mode: 0o600 },
  );
}, 60000);
afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await runtime?.pool.end();
  await owner?.pool.end();
});
const delivery = () => {
  const value = bindLocalTransactionalDelivery(runtime);
  if (!value) throw Error("Actual local binding refused.");
  return value;
};
async function booking() {
  const [slot] = await readWorkflowCandidates(context, parent.headers, choice);
  if (!slot) throw Error("Synthetic slot unavailable.");
  return createPolicyReservation(context, parent.headers, {
    ...choice,
    startAtUtc: slot.startAtUtc,
    endAtUtc: slot.endAtUtc,
    idempotencyKey: randomUUID(),
  });
}
async function rows(eventId: string) {
  return (
    await owner.pool.query(
      "SELECT state,attempts,recipient_user_id FROM transactional_deliveries WHERE event_id=$1 ORDER BY recipient_user_id",
      [eventId],
    )
  ).rows;
}

it("sends only owner confirmation/reschedule/cancellation with replacement time and no duplicate after replay", async () => {
  requests = [];
  mode = "accepted";
  const initial = await booking();
  expect(initial.state).toBe("confirmed");
  const simultaneous = await Promise.all([
    drainTransactionalDeliveries(delivery(), { eventId: initial.eventId }),
    drainTransactionalDeliveries(delivery(), { eventId: initial.eventId }),
  ]);
  expect(simultaneous.reduce((n, r) => n + r.providerAccepted, 0)).toBe(1);
  expect(requests).toHaveLength(1);
  expect(
    (await rows(initial.eventId))
      .filter((r) => r.state === "pending")
      .map((r) => r.recipient_user_id),
  ).toEqual([tutor.id]);
  const [slot] = await readWorkflowMoveCandidates(
    context,
    parent.headers,
    initial.id,
  );
  if (!slot) throw Error("Replacement slot missing.");
  const move = {
    requestId: randomUUID(),
    expectedRevision: initial.workflowRevision,
    reasonCode: "local_participant_change",
    startAtUtc: slot.startAtUtc,
    endAtUtc: slot.endAtUtc,
    displayTimezone: "Asia/Manila",
  };
  const moved = await changePolicyBooking(
    context,
    parent.headers,
    initial.id,
    "reschedule",
    move,
  );
  expect(
    (await drainTransactionalDeliveries(delivery(), { eventId: moved.eventId }))
      .providerAccepted,
  ).toBe(1);
  expect(
    await changePolicyBooking(
      context,
      parent.headers,
      initial.id,
      "reschedule",
      move,
    ),
  ).toEqual(moved);
  expect(
    (await drainTransactionalDeliveries(delivery(), { eventId: moved.eventId }))
      .providerAccepted,
  ).toBe(0);
  const persisted = (
    await owner.pool.query(
      "SELECT payload FROM transactional_deliveries WHERE event_id=$1 AND recipient_user_id=$2",
      [moved.eventId, parent.id],
    )
  ).rows[0].payload;
  expect(persisted.startAtUtc).toBe(slot.startAtUtc);
  expect(persisted.endAtUtc).toBe(slot.endAtUtc);
  const cancelled = await changePolicyBooking(
    context,
    parent.headers,
    moved.id,
    "cancel",
    {
      requestId: randomUUID(),
      expectedRevision: moved.workflowRevision,
      reasonCode: "local_participant_change",
    },
  );
  expect(
    (
      await drainTransactionalDeliveries(delivery(), {
        eventId: cancelled.eventId,
      })
    ).providerAccepted,
  ).toBe(1);
  expect(requests.map((r) => JSON.parse(r.body).subject)).toEqual([
    "Booking confirmed | Learli",
    "Booking rescheduled | Learli",
    "Booking cancelled | Learli",
  ]);
  for (const sent of requests) {
    const body = JSON.parse(sent.body);
    expect(body.to).toEqual([parent.email]);
    expect(body.html).not.toMatch(/meetingUrl|Synthetic child/);
    expect(body.text).toContain("Asia/Manila");
  }
  expect(new Set(requests.map((r) => r.key)).size).toBe(3);
  // The configured owner can also be the assigned Tutor. Its own untouched
  // delivery gets Tutor navigation, never a redirected Parent message.
  vi.stubEnv("LOCAL_VERIFICATION_RECIPIENT", tutor.email);
  try {
    expect(
      (
        await drainTransactionalDeliveries(delivery(), {
          eventId: cancelled.eventId,
        })
      ).providerAccepted,
    ).toBe(1);
    const tutorMail = JSON.parse(requests.at(-1)!.body);
    expect(tutorMail.to).toEqual([tutor.email]);
    expect(tutorMail.text).toContain(`/bookings/${cancelled.id}?scope=tutor`);
  } finally {
    vi.stubEnv("LOCAL_VERIFICATION_RECIPIENT", parent.email);
  }
});

it("keeps confirmation committed after rate limiting and retries the identical material/key", async () => {
  requests = [];
  mode = "429";
  const initial = await booking();
  expect(
    (
      await drainTransactionalDeliveries(delivery(), {
        eventId: initial.eventId,
      })
    ).retryable,
  ).toBe(1);
  expect(
    (
      await owner.pool.query("SELECT state FROM bookings WHERE id=$1", [
        initial.id,
      ])
    ).rows[0].state,
  ).toBe("confirmed");
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    const ready = (
      await owner.pool.query(
        "SELECT next_attempt_at<=clock_timestamp() ready FROM transactional_deliveries WHERE event_id=$1 AND recipient_user_id=$2",
        [initial.eventId, parent.id],
      )
    ).rows[0].ready;
    if (ready) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  mode = "accepted";
  expect(
    (
      await drainTransactionalDeliveries(delivery(), {
        eventId: initial.eventId,
      })
    ).providerAccepted,
  ).toBe(1);
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
});

it("suppresses stale confirmation and revoked participant notices, and never claims excluded recipient/kinds", async () => {
  requests = [];
  const initial = await booking();
  const cancelled = await changePolicyBooking(
    context,
    parent.headers,
    initial.id,
    "cancel",
    {
      requestId: randomUUID(),
      expectedRevision: initial.workflowRevision,
      reasonCode: "local_participant_change",
    },
  );
  expect(
    (
      await drainTransactionalDeliveries(delivery(), {
        eventId: initial.eventId,
      })
    ).suppressed,
  ).toBe(1);
  await owner.pool.query(
    "UPDATE user_access SET status='suspended' WHERE user_id=$1",
    [parent.id],
  );
  try {
    expect(
      (
        await drainTransactionalDeliveries(delivery(), {
          eventId: cancelled.eventId,
        })
      ).suppressed,
    ).toBe(1);
  } finally {
    await owner.pool.query(
      "UPDATE user_access SET status='active' WHERE user_id=$1",
      [parent.id],
    );
  }
  expect(requests).toHaveLength(0);
  expect(
    (await rows(cancelled.eventId)).find(
      (r) => r.recipient_user_id === tutor.id,
    )?.state,
  ).toBe("pending");
});

async function claim(kind: string, target: string) {
  const identity = await runtime.auth.api.getSession({
    headers: admin.headers,
    query: { disableCookieCache: true },
  });
  if (!identity) throw Error("Synthetic reviewer missing.");
  const result = await runtime.db.execute<{ outcome: string }>(
    sql`SELECT * FROM public.claim_local_workflow_task(${admin.id},${identity.session.id},${kind},${target},${randomUUID()}::uuid)`,
  );
  expect(["claimed", "replayed", "saved", "existing"]).toContain(
    result.rows[0]?.outcome,
  );
}
/** Inserts new synthetic historical records once with all database guards on.
 * No existing booking time, deadline, policy or event is rewritten. */
async function historical(input: {
  learnerId: string;
  state: "provisional" | "confirmed";
  due?: boolean;
  endedOffset?: number;
  startOffset?: number;
}) {
  const tutorId = (
    await owner.pool.query("SELECT id FROM tutor_profiles WHERE user_id=$1", [
      tutor.id,
    ])
  ).rows[0].id;
  const subjectId = (
    await owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
  ).rows[0].id;
  const provisional = input.state === "provisional";
  const policy = provisional ? localBookingPolicy : localParentBookingPolicy;
  const admissionId = provisional
    ? localBookingPolicy.admissionPolicyId
    : localGuardianAdmissionPolicy.policyId;
  const id = randomUUID(),
    eventId = randomUUID(),
    key = randomUUID();
  const end =
    input.endedOffset === undefined
      ? Date.now() + (input.startOffset ?? 4) * 3600000
      : Date.now() - input.endedOffset * 60000;
  const start = end - 3600000;
  const created =
    input.due || !provisional ? Date.now() - 2 * 3600000 : Date.now() - 60000;
  const expires = created + 10 * 60000;
  const client = await owner.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at,workflow_policy_id,admission_policy_id) VALUES($1,'local_operation',$2,$3,$4,$5,$6,$7,'Asia/Manila',$8,$9,$10,$11,$12,$13,$14)",
      [
        id,
        tutorId,
        input.learnerId,
        parent.id,
        subjectId,
        new Date(start).toISOString(),
        new Date(end).toISOString(),
        key,
        "a".repeat(64),
        input.state,
        new Date(created),
        new Date(expires),
        policy.policyId,
        admissionId,
      ],
    );
    await client.query(
      "INSERT INTO booking_lifecycle_events(id,logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code) VALUES($1,$2,$2,$3,$4,$5,$6,$7,$8,0,$9)",
      [
        eventId,
        id,
        parent.id,
        provisional ? "workflow_provisional" : "workflow_confirmed",
        key,
        "a".repeat(64),
        new Date(created),
        policy.policyId,
        provisional ? "local_request" : "local_parent_booking",
      ],
    );
    await client.query("COMMIT");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  return { id, eventId, expiresAtUtc: new Date(expires).toISOString() };
}

it("sends genuine provisional deadline and expires overdue holds exactly once without premature expiry or stale mail", async () => {
  mode = "accepted";
  requests = [];
  const admission = admissionContext(runtime);
  if (admission.admission.authority === "disabled")
    throw Error("Legacy fixture policy missing.");
  const pending = await createAdmission(admission, parent.headers, {
    requestId: randomUUID(),
    policyVersion: admission.admission.version,
    policyDigest: admission.admission.contentDigest,
    management: "guardian",
    displayName: "Historical synthetic child",
    level: "middle_school",
    grade: 8,
    timezone: "Asia/Manila",
  });
  await claim("admission", pending.id);
  for (const checkCode of ["guardian_authority", "guardian_notice"]) {
    const current = await readAssignedAdmission(
      admission,
      admin.headers,
      pending.id,
    );
    await mutateAdmissionReview(
      admission,
      admin.headers,
      pending.id,
      "evidence",
      {
        requestId: randomUUID(),
        revision: current.revision,
        checkCode,
        reference: `local:${randomUUID()}`,
      },
    );
  }
  const reviewed = await readAssignedAdmission(
    admission,
    admin.headers,
    pending.id,
  );
  await mutateAdmissionReview(
    admission,
    admin.headers,
    pending.id,
    "decision",
    {
      requestId: randomUUID(),
      revision: reviewed.revision,
      action: "authorize",
    },
  );
  historicalLearnerId = pending.learner.id;
  const confirmed = await booking();
  const fresh = await historical({
    learnerId: pending.learner.id,
    state: "provisional",
    startOffset: 9,
  });
  const due = await historical({
    learnerId: pending.learner.id,
    state: "provisional",
    due: true,
    startOffset: 11,
  });
  const { currentDeliveryMaterial } =
    await import("@/features/transactional-delivery/recipient");
  const attempt = Date.now();
  const payload = await currentDeliveryMaterial(
    runtime.db,
    fresh.eventId,
    parent.id,
    "workflow_provisional",
    attempt,
  );
  expect(payload).not.toBeNull();
  for (const overrides of [
    { expiresAtUtc: new Date(attempt + 60000).toISOString() },
    { learnerName: "private" },
  ]) {
    const guarded = await owner.pool.connect();
    try {
      await guarded.query("BEGIN");
      await guarded.query(
        "UPDATE transactional_deliveries SET state='claimed',claim_token=$1,claim_until=clock_timestamp()+interval '60 seconds' WHERE event_id=$2 AND recipient_user_id=$3",
        [randomUUID(), fresh.eventId, parent.id],
      );
      await expect(
        guarded.query(
          "UPDATE transactional_deliveries SET payload=$1,idempotency_key=$2,payload_fingerprint=$3,configuration_fingerprint=$3,first_attempt_at=$4,last_attempt_at=$4,attempts=1 WHERE event_id=$5 AND recipient_user_id=$6",
          [
            { ...payload, ...overrides },
            `learli/${"a".repeat(64)}`,
            "a".repeat(64),
            new Date(attempt),
            fresh.eventId,
            parent.id,
          ],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    } finally {
      await guarded.query("ROLLBACK");
      guarded.release();
    }
  }
  expect(
    (await drainTransactionalDeliveries(delivery(), { eventId: fresh.eventId }))
      .providerAccepted,
  ).toBe(1);
  expect(JSON.parse(requests[0]!.body).text).toContain("not confirmed");
  const material = (
    await owner.pool.query(
      "SELECT payload FROM transactional_deliveries WHERE event_id=$1 AND recipient_user_id=$2",
      [fresh.eventId, parent.id],
    )
  ).rows[0].payload;
  expect(material.expiresAtUtc).toBe(fresh.expiresAtUtc);
  await Promise.all([
    reconcileLocalBookingExpiry(runtime),
    reconcileLocalBookingExpiry(runtime),
  ]);
  const events = (
    await owner.pool.query(
      "SELECT id FROM booking_lifecycle_events WHERE booking_id=$1 AND event='workflow_expired'",
      [due.id],
    )
  ).rows;
  expect(events).toHaveLength(1);
  expect(
    (await drainTransactionalDeliveries(delivery(), { eventId: due.eventId }))
      .suppressed,
  ).toBe(1);
  expect(
    (await drainTransactionalDeliveries(delivery(), { eventId: events[0].id }))
      .providerAccepted,
  ).toBe(1);
  expect(JSON.parse(requests.at(-1)!.body).subject).toBe(
    "Booking expired | Learli",
  );
  await drainLocalBookingNotices(runtime, { limit: 25 });
  const states = (
    await owner.pool.query(
      "SELECT id,state FROM bookings WHERE id=ANY($1::uuid[])",
      [[fresh.id, due.id, confirmed.id]],
    )
  ).rows;
  expect(states.find((r) => r.id === fresh.id).state).toBe("provisional");
  expect(states.find((r) => r.id === due.id).state).toBe("expired");
  expect(states.find((r) => r.id === confirmed.id).state).toBe("confirmed");
  expect(
    (await rows(events[0].id)).find((r) => r.recipient_user_id === tutor.id)
      .state,
  ).toBe("pending");
});

it("emails recorded completion/no-show only after authorized elapsed-time outcomes and preserves replay identity", async () => {
  requests = [];
  mode = "accepted";
  const future = await booking();
  await expect(
    changePolicyBooking(context, tutor.headers, future.id, "complete", {
      requestId: randomUUID(),
      expectedRevision: 0,
      reasonCode: "local_completed",
    }),
  ).rejects.toMatchObject({ status: 409 });
  const completed = await historical({
    learnerId: choice.learnerId,
    state: "confirmed",
    endedOffset: 30,
  });
  const noShow = await historical({
    learnerId: choice.learnerId,
    state: "confirmed",
    endedOffset: 100,
  });
  for (const [value, action, reasonCode, actor] of [
    [completed, "complete", "local_completed", tutor],
    [noShow, "no_show", "local_no_show", admin],
  ] as const) {
    const input = { requestId: randomUUID(), expectedRevision: 0, reasonCode };
    await expect(
      changePolicyBooking(context, parent.headers, value.id, action, input),
    ).rejects.toMatchObject({ status: action === "no_show" ? 403 : 404 });
    if (action === "no_show") {
      await expect(
        changePolicyBooking(context, admin.headers, value.id, action, input),
      ).rejects.toMatchObject({ status: 404 });
      // Explicit trusted assignment for this new synthetic historical outcome;
      // the ordinary claim UI only accepts live provisional confirmation tasks.
      await owner.pool.query(
        "INSERT INTO booking_workflow_grants(logical_booking_id,actor_user_id,action,active,valid_until,reference) VALUES($1,$2,'no_show',true,NULL,$3)",
        [value.id, admin.id, `local:${randomUUID()}`],
      );
    }
    const saved = await changePolicyBooking(
      context,
      actor.headers,
      value.id,
      action,
      input,
    );
    expect(saved.state).toBe(action === "complete" ? "completed" : "no_show");
    expect(
      (
        await drainTransactionalDeliveries(delivery(), {
          eventId: saved.eventId,
        })
      ).providerAccepted,
    ).toBe(1);
    expect(JSON.parse(requests.at(-1)!.body).text).toContain(
      "does not verify lesson attendance",
    );
    expect(
      await changePolicyBooking(
        context,
        actor.headers,
        value.id,
        action,
        input,
      ),
    ).toEqual(saved);
    expect(
      (
        await drainTransactionalDeliveries(delivery(), {
          eventId: saved.eventId,
        })
      ).providerAccepted,
    ).toBe(0);
    expect(
      (
        await drainTransactionalDeliveries(delivery(), {
          eventId: value.eventId,
        })
      ).suppressed,
    ).toBe(1);
  }
  expect(requests.map((r) => JSON.parse(r.body).subject)).toEqual([
    "Booking marked completed | Learli",
    "Booking marked no-show | Learli",
  ]);
  const browserProvisional = await historical({
    learnerId: historicalLearnerId,
    state: "provisional",
    startOffset: 15,
  });
  const browserDue = await historical({
    learnerId: historicalLearnerId,
    state: "provisional",
    due: true,
    startOffset: 13,
  });
  const browserCompleted = await historical({
    learnerId: choice.learnerId,
    state: "confirmed",
    endedOffset: 160,
  });
  const browserNoShow = await historical({
    learnerId: choice.learnerId,
    state: "confirmed",
    endedOffset: 230,
  });
  await owner.pool.query(
    "INSERT INTO booking_workflow_grants(logical_booking_id,actor_user_id,action,active,valid_until,reference) VALUES($1,$2,'no_show',true,NULL,$3)",
    [browserNoShow.id, admin.id, `local:${randomUUID()}`],
  );
  writeFileSync(
    path.join(root, "lifecycle-fixture.json"),
    JSON.stringify({
      provisional: browserProvisional,
      due: browserDue,
      completed: browserCompleted,
      noShow: browserNoShow,
    }),
    { mode: 0o600 },
  );
});
