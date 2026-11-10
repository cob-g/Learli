// Opt-in synthetic setup for an independently owned copy, never the main checkout.
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID, randomBytes } from "node:crypto";
import path from "node:path";
import { z } from "zod";

const root = realpathSync(process.cwd());
if (
  (process.env.LEARLI_PERFORMANCE_ROOT &&
    realpathSync(process.env.LEARLI_PERFORMANCE_ROOT)) !== root ||
  !root.startsWith(`${realpathSync("/tmp")}/learli-booking-perf-`) ||
  readFileSync(".local/postgres/learli-owned", "utf8") !==
    "Learli local development cluster\n"
)
  throw new Error("Explicit owned performance copy required.");
const state = z
  .object({
    ports: z.object({
      database: z.literal(55435),
      development: z.literal(3410),
    }),
  })
  .parse(JSON.parse(readFileSync(".local/database.json", "utf8")));
const configured = z
  .object({ DATABASE_URL: z.string(), DATABASE_URL_DIRECT: z.string() })
  .catchall(z.string())
  .parse(parseEnv(readFileSync(".env.local", "utf8")));
for (const name of ["DATABASE_URL", "DATABASE_URL_DIRECT"] as const) {
  const url = new URL(configured[name]);
  if (
    url.hostname !== "127.0.0.1" ||
    Number(url.port) !== state.ports.database ||
    url.pathname !== "/learli_dev"
  )
    throw new Error("Owned performance database required.");
}
Object.assign(process.env, configured, {
  LOCAL_WORKFLOW_MODE: "enabled",
  DATABASE_URL_DIRECT: "",
  HOSTED_AUTH_CONFIG_FILE: "",
  HOSTED_INGRESS_SECRET: "",
  RESEND_API_KEY: "",
  EMAIL_FROM: "",
  DATABASE_MODE: "local",
  PRIVATE_WORKFLOW_CONFIG_FILE: "",
  NEON_DEVELOPMENT_CONFIG_FILE: "",
  GOOGLE_MEET_ENABLED: "false",
});
const { createLocalAuth } = await import("../../src/lib/auth-factory");
const { createDatabase } = await import("../../src/lib/db/connection");
const { handleAuthRequest } = await import("../../src/lib/auth-handler");
const { prepareLocalPolicies, prepareLocalStaff } =
  await import("../local-workflow");
const { enrollTestAdmin } = await import("../../tests/support/admin-mfa");
const { createParentChild, readParentChildIntake } =
  await import("../../src/features/parent-children/service");
const { createIndependentLearner, readIndependentLearnerIntake } =
  await import("../../src/features/independent-learner/service");
const { enrollParentWorkspace } =
  await import("../../src/features/parent-onboarding/service");
const { startTutorApplication, saveOwnTutorProfile, readOwnTutorProfile } =
  await import("../../src/features/tutors/service");
const { getScreeningContext } =
  await import("../../src/features/tutor-screening/composition");
const { localScreeningPolicy } =
  await import("../../src/features/tutor-screening/policy");
const {
  requestScreening,
  readScreening,
  recordScreeningCheck,
  decideScreening,
} = await import("../../src/features/tutor-screening/service");
const { saveOwnAvailability } =
  await import("../../src/features/availability/service");
const { bookingWorkflowContext } =
  await import("../../src/features/booking-workflows/composition");
const { readWorkflowCandidates, createPolicyReservation } =
  await import("../../src/features/booking-workflows/service");
const { readdir } = await import("node:fs/promises");
const runtime = createLocalAuth(process.env);
const owner = createDatabase(configured.DATABASE_URL_DIRECT);
const password = randomBytes(32).toString("hex");
async function account(name: string) {
  const email = `performance-${randomUUID()}@learli.test`;
  const call = (route: string, body: unknown) =>
    handleAuthRequest(
      runtime,
      new Request(`${runtime.origin}/api/auth/${route}`, {
        method: "POST",
        headers: { origin: runtime.origin, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  const signup = await call("sign-up/email", { name, email, password });
  if (!signup.ok) throw new Error(`Fixture registration HTTP ${signup.status}`);
  const id = z.string().parse((await signup.json()).user.id);
  const mailbox = path.join(root, ".local/mail/development");
  let verified = false;
  for (const file of await readdir(mailbox)) {
    if (!file.endsWith(".json")) continue;
    const message = JSON.parse(readFileSync(path.join(mailbox, file), "utf8"));
    if (message.to === email && message.kind === "verification") {
      const response = await handleAuthRequest(
        runtime,
        new Request(message.url),
      );
      if (response.status !== 302)
        throw new Error("Fixture verification failed");
      verified = true;
      break;
    }
  }
  if (!verified) throw new Error("Fixture verification missing");
  const signin = await call("sign-in/email", { email, password });
  if (!signin.ok) throw new Error(`Fixture sign-in HTTP ${signin.status}`);
  const cookie = signin.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  return { id, cookie, headers: new Headers({ cookie }) };
}
try {
  if (
    (await owner.pool.query('SELECT count(*)::int n FROM "user"')).rows[0].n !==
    0
  )
    throw new Error(
      "Setup requires a fresh synthetic database; no data reset.",
    );
  const client = await owner.pool.connect();
  try {
    await client.query("BEGIN");
    await prepareLocalPolicies(client);
    await client.query("COMMIT");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  const admin = await account("Performance reviewer");
  const setup = await owner.pool.connect();
  try {
    await setup.query("BEGIN");
    await prepareLocalStaff(setup, admin.id);
    await setup.query("COMMIT");
  } finally {
    await setup.query("ROLLBACK");
    setup.release();
  }
  admin.cookie = await enrollTestAdmin(runtime, admin.cookie, password);
  admin.headers = new Headers({ cookie: admin.cookie });
  const parent = await account("Performance Parent");
  const student = await account("Performance Student");
  const tutor = await account("Performance Tutor");
  await enrollParentWorkspace(runtime, parent.headers, {});
  const intake = await readParentChildIntake(runtime, parent.headers);
  if (!intake.enabled) throw new Error("Parent intake unavailable");
  const child = await createParentChild(runtime, parent.headers, {
    requestId: randomUUID(),
    policyVersion: intake.policyVersion,
    policyDigest: intake.policyDigest,
    noticeVersion: intake.noticeVersion,
    guardianConfirmed: true,
    consentConfirmed: true,
    displayName: "Synthetic performance child",
    level: "high_school",
    timezone: "Asia/Manila",
  });
  const independent = await readIndependentLearnerIntake(
    runtime,
    student.headers,
  );
  if (!independent.enabled) throw new Error("Student intake unavailable");
  const self = await createIndependentLearner(runtime, student.headers, {
    requestId: randomUUID(),
    policyVersion: independent.policyVersion,
    policyDigest: independent.policyDigest,
    noticeVersion: independent.noticeVersion,
    eligibilityDeclared: true,
    displayName: "Synthetic performance Student",
    timezone: "Asia/Manila",
  });
  await startTutorApplication(runtime, tutor.headers, {});
  const subject = (
    await owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
  ).rows[0].id;
  await saveOwnTutorProfile(runtime, tutor.headers, {
    headline: "Synthetic performance tutoring",
    bio: "Isolated synthetic timing fixture.",
    teachingBackground: "No real qualifications asserted.",
    timezone: "Asia/Manila",
    offerings: [
      { subjectId: subject, levels: ["high_school", "college_support"] },
    ],
  });
  const profile = await readOwnTutorProfile(runtime, tutor.headers);
  if (!profile) throw new Error("Tutor profile unavailable");
  const screening = getScreeningContext(runtime);
  await requestScreening(screening, tutor.headers, profile.id, {
    requestKey: randomUUID(),
  });
  const session = await runtime.auth.api.getSession({ headers: admin.headers });
  if (!session) throw new Error("Reviewer session unavailable");
  await runtime.pool.query(
    "SELECT * FROM public.claim_local_workflow_task($1,$2,'screening',$3,$4::uuid)",
    [admin.id, session.session.id, profile.id, randomUUID()],
  );
  for (const code of localScreeningPolicy.requiredCheckCodes) {
    const current = await readScreening(screening, admin.headers, profile.id);
    if (!current) throw new Error("Screening unavailable");
    await recordScreeningCheck(screening, admin.headers, profile.id, {
      revision: current.revision,
      requestKey: randomUUID(),
      code,
      outcome: "passed",
      reference: `screening:${randomUUID()}`,
      checkedAt: new Date(Date.now() - 60000).toISOString(),
      expiresAt: new Date(Date.now() + 16 * 86400000).toISOString(),
    });
  }
  const current = await readScreening(screening, admin.headers, profile.id);
  if (!current) throw new Error("Screening unavailable");
  await decideScreening(screening, admin.headers, profile.id, {
    revision: current.revision,
    requestKey: randomUUID(),
    action: "approve",
  });
  await saveOwnAvailability(runtime, tutor.headers, {
    version: 0,
    timezone: "Asia/Manila",
    windows: Array.from({ length: 7 }, (_, i) => ({
      isoWeekday: i + 1,
      startMinute: 540,
      endMinute: 1080,
    })),
  });
  const choice = {
    learnerId: child.id,
    tutorSlug: profile.slug,
    subjectSlug: "math",
    displayTimezone: "UTC",
  };
  const context = bookingWorkflowContext(runtime);
  const times = await readWorkflowCandidates(context, parent.headers, choice);
  if (times.length < 42)
    throw new Error("Insufficient synthetic candidate workload");
  const parentBooking = await createPolicyReservation(context, parent.headers, {
    ...choice,
    startAtUtc: times[0].startAtUtc,
    endAtUtc: times[0].endAtUtc,
    idempotencyKey: randomUUID(),
  });
  const studentChoice = { ...choice, learnerId: self.id };
  const studentTimes = await readWorkflowCandidates(
    context,
    student.headers,
    studentChoice,
  );
  const studentBooking = await createPolicyReservation(
    context,
    student.headers,
    {
      ...studentChoice,
      startAtUtc: studentTimes[0].startAtUtc,
      endAtUtc: studentTimes[0].endAtUtc,
      idempotencyKey: randomUUID(),
    },
  );
  writeFileSync(
    ".local/performance-fixture.json",
    JSON.stringify({
      origin: runtime.origin,
      parent: {
        id: parent.id,
        cookie: parent.cookie,
        learnerId: child.id,
        bookingId: parentBooking.id,
      },
      student: {
        id: student.id,
        cookie: student.cookie,
        learnerId: self.id,
        bookingId: studentBooking.id,
      },
      tutor: {
        id: tutor.id,
        cookie: tutor.cookie,
        profileId: profile.id,
        slug: profile.slug,
      },
      candidateCount: times.length,
    }),
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    `Prepared isolated current Parent/Student/Tutor workflows; ${times.length} candidates.`,
  );
} finally {
  await runtime.pool.end();
  await owner.pool.end();
}
