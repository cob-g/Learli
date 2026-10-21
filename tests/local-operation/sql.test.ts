// Actual restricted-role SQL boundaries on the separate owned ordinary-mode fixture.
import { randomUUID } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { createLocalAuth, type LocalAuthRuntime } from "@/lib/auth-factory";
import { createDatabase } from "@/lib/db/connection";
import { handleAuthRequest } from "@/lib/auth-handler";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import {
  localAdmissionPolicy as admission,
  localGuardianAdmissionPolicy as guardian,
  localIndependentAdmissionPolicy as independentAdmission,
} from "@/features/learner-admission/policy";
import {
  localBookingPolicy as booking,
  localIndependentBookingPolicy as independentBookingPolicy,
  localParentBookingPolicy as parentBooking,
} from "@/features/booking-workflows/policy";
import { localScreeningPolicy as screening } from "@/features/tutor-screening/policy";
import {
  prepareLocalPolicies,
  prepareLocalStaff,
} from "../../scripts/local-workflow";
import { verifyRuntimeGrants } from "../../scripts/staging-migrations/privileges";
import { enrollTestAdmin } from "../support/admin-mfa";
import type { LocalMessage } from "@/lib/email/local-mail";

type Actor = { id: string; sessionId: string; cookie: string };
let runtime: LocalAuthRuntime;
let owner: ReturnType<typeof createDatabase>;
let fixture: string;
let admin: Actor,
  secondAdmin: Actor,
  parent: Actor,
  tutor: Actor,
  unrelated: Actor;
let learnerId: string,
  admissionId: string,
  tutorId: string,
  subjectId: string,
  bookingId: string;
const password = "Ordinary-SQL-fixture-passphrase-123";

async function account(): Promise<Actor> {
  const email = `sql-${randomUUID()}@example.invalid`;
  const request = (route: string, body: unknown) =>
    handleAuthRequest(
      runtime,
      new Request(`${runtime.origin}/api/auth/${route}`, {
        method: "POST",
        headers: { origin: runtime.origin, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  expect(
    (
      await request("sign-up/email", {
        name: "SQL boundary fixture",
        email,
        password,
        callbackURL: "/account",
      })
    ).status,
  ).toBe(200);
  const directory = path.join(fixture, ".local/mail/development");
  let message: LocalMessage | undefined;
  for (const file of (await readdir(directory)).filter((f) =>
    f.endsWith(".json"),
  )) {
    const value = JSON.parse(
      await readFile(path.join(directory, file), "utf8"),
    ) as LocalMessage;
    if (value.to === email && value.kind === "verification") {
      message = value;
      break;
    }
  }
  if (!message) throw new Error("Actual local verification capture required.");
  expect(
    (await handleAuthRequest(runtime, new Request(message.url))).status,
  ).toBe(302);
  const signed = await request("sign-in/email", { email, password });
  expect(signed.status).toBe(200);
  const cookie = signed.headers
    .getSetCookie()
    .map((p) => p.split(";")[0])
    .join("; ");
  const session = await runtime.auth.api.getSession({
    headers: new Headers({ cookie }),
  });
  if (!session) throw new Error("Actual provider session required.");
  return { id: session.user.id, sessionId: session.session.id, cookie };
}
async function claim(
  actor: Actor,
  kind: string,
  target: string,
  request = randomUUID(),
  client?: PoolClient,
) {
  const result = await (client ?? runtime.pool).query(
    "SELECT * FROM public.claim_local_workflow_task($1,$2,$3,$4,$5)",
    [actor.id, actor.sessionId, kind, target, request],
  );
  return result.rows[0] as { outcome: string; target_id: string | null };
}
async function authorizeChild(actor: Actor) {
  const made = await runtime.pool.query(
    "SELECT * FROM public.create_learner_admission_with_grade($1,$2,$3,$4,'guardian','Local fixture learner','middle_school','UTC',NULL,8)",
    [actor.id, actor.sessionId, randomUUID(), admission.policyId],
  );
  expect(made.rows[0].outcome).toBe("created");
  const id = made.rows[0].admission_id as string;
  expect((await claim(admin, "admission", id)).outcome).toBe("saved");
  let revision = (
    await owner.pool.query(
      "SELECT revision FROM public.learner_admissions WHERE id=$1",
      [id],
    )
  ).rows[0].revision as number;
  for (const code of ["guardian_authority", "guardian_notice"]) {
    const proof = await runtime.pool.query(
      "SELECT * FROM public.record_learner_admission_evidence($1,$2,$3,$4,$5,$6,$7)",
      [
        admin.id,
        admin.sessionId,
        id,
        revision,
        randomUUID(),
        code,
        `local:${randomUUID()}`,
      ],
    );
    expect(proof.rows[0].outcome).toBe("recorded");
    revision = proof.rows[0].revision;
  }
  const decision = await runtime.pool.query(
    "SELECT * FROM public.decide_learner_admission($1,$2,$3,$4,$5,'authorize')",
    [admin.id, admin.sessionId, id, revision, randomUUID()],
  );
  expect(decision.rows[0].outcome).toBe("decided");
  return { id, learnerId: made.rows[0].learner_id as string };
}
async function waitForLock(pid: number) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const row = (
      await owner.pool.query(
        "SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",
        [pid],
      )
    ).rows[0];
    if (row?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Expected the actual SQL claim lock wait.");
}

beforeAll(async () => {
  const root = process.cwd();
  fixture = path.resolve(root, ".local/local-operation-20261018/fixture");
  if (
    process.env.LOCAL_OPERATION_FIXTURE_ROOT !== fixture ||
    process.env.APP_ENV !== "development" ||
    process.env.LOCAL_WORKFLOW_MODE !== "enabled"
  )
    throw new Error("Explicit ordinary-mode fixture required.");
  const file = path.join(fixture, ".env.operation.owner.local"),
    stat = lstatSync(file);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o7777) !== 0o600 ||
    stat.uid !== process.getuid?.()
  )
    throw new Error("Private owned fixture authority required.");
  const env = parseEnv(readFileSync(file, "utf8")),
    url = new URL(env.DATABASE_URL_DIRECT!);
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "55434" ||
    url.pathname !== "/learli_dev" ||
    url.username !== "learli_owner"
  )
    throw new Error("Operating database is never a test target.");
  owner = createDatabase(env.DATABASE_URL_DIRECT!);
  runtime = createLocalAuth(process.env);
  expect(getLocalWorkflow(runtime)?.database.port).toBe(55434);
  vi.spyOn(process, "cwd").mockReturnValue(fixture);
  // Isolated fixture provisioning follows completed auth-suite throttle assertions.
  await owner.pool.query(
    "UPDATE public.rate_limit SET count=0 WHERE key LIKE '%/sign-up/email%' OR key LIKE '%/sign-in/email%' OR key LIKE '%/two-factor/%'",
  );
  [admin, secondAdmin, parent, tutor, unrelated] = await Promise.all([
    account(),
    account(),
    account(),
    account(),
    account(),
  ]);
  const client = await owner.pool.connect();
  try {
    await client.query("BEGIN");
    await prepareLocalPolicies(client);
    await prepareLocalStaff(client, admin.id);
    await prepareLocalStaff(client, secondAdmin.id);
    await client.query("COMMIT");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
  for (const actor of [admin, secondAdmin]) {
    actor.cookie = await enrollTestAdmin(runtime, actor.cookie, password);
    const current = await runtime.auth.api.getSession({
      headers: new Headers({ cookie: actor.cookie }),
    });
    if (!current) throw new Error("Actual current MFA session required.");
    actor.sessionId = current.session.id;
  }
  await owner.pool.query(
    "INSERT INTO public.user_roles(user_id,role) VALUES($1,'parent'),($2,'tutor')",
    [parent.id, tutor.id],
  );
  tutorId = randomUUID();
  subjectId = randomUUID();
  await owner.pool.query(
    "INSERT INTO public.tutor_profiles(id,user_id,slug,headline,bio,teaching_background,timezone) VALUES($1,$2,$3,'Local teaching offer','Local fixture biography','Local fixture background','UTC')",
    [tutorId, tutor.id, `sql-${randomUUID()}`],
  );
  await owner.pool.query(
    "INSERT INTO public.subjects(id,slug,name,category) VALUES($1,$2,$3,'academic_core')",
    [
      subjectId,
      `sql-${randomUUID()}`,
      `SQL Science ${randomUUID().slice(0, 8)}`,
    ],
  );
  await owner.pool.query(
    "INSERT INTO public.tutor_subjects(tutor_id,subject_id,levels) VALUES($1,$2,ARRAY['middle_school'])",
    [tutorId, subjectId],
  );
  for (let day = 1; day <= 7; day++)
    await owner.pool.query(
      "INSERT INTO public.tutor_availability(tutor_id,iso_weekday,start_minute,end_minute) VALUES($1,$2,0,1440)",
      [tutorId, day],
    );
}, 30000);
afterAll(async () => {
  vi.restoreAllMocks();
  await runtime?.pool.end();
  await owner?.pool.end();
});

describe("ordinary source SQL authority and durable workflow", () => {
  it("refuses a prior claim receipt after nested capability revocation or reassignment", async () => {
    const made = await runtime.pool.query(
      "SELECT * FROM public.create_learner_admission($1,$2,$3,$4,'guardian','Replay claim fixture','middle_school','UTC',NULL)",
      [parent.id, parent.sessionId, randomUUID(), admission.policyId],
    );
    const target = made.rows[0].admission_id,
      key = randomUUID();
    expect((await claim(admin, "admission", target, key)).outcome).toBe(
      "saved",
    );
    await owner.pool.query(
      "UPDATE public.learner_admission_reviewers SET active=false WHERE user_id=$1 AND source='local_operation'",
      [admin.id],
    );
    try {
      expect((await claim(admin, "admission", target, key)).outcome).toBe(
        "forbidden",
      );
    } finally {
      await owner.pool.query(
        "UPDATE public.learner_admission_reviewers SET active=true WHERE user_id=$1 AND source='local_operation'",
        [admin.id],
      );
    }
    expect((await claim(admin, "admission", target, key)).outcome).toBe(
      "replayed",
    );
    await owner.pool.query(
      "UPDATE public.learner_admission_assignments SET reviewer_user_id=$1 WHERE admission_id=$2",
      [secondAdmin.id, target],
    );
    expect((await claim(admin, "admission", target, key)).outcome).toBe(
      "forbidden",
    );
    expect(
      (
        await owner.pool.query(
          "SELECT reviewer_user_id FROM public.learner_admission_assignments WHERE admission_id=$1",
          [target],
        )
      ).rows[0].reviewer_user_id,
    ).toBe(secondAdmin.id);
    expect(
      (
        await owner.pool.query(
          "SELECT count(*)::int AS count FROM public.local_workflow_claims WHERE actor_user_id=$1 AND request_id=$2",
          [admin.id, key],
        )
      ).rows[0].count,
    ).toBe(1);
  });
  it("preserves exact restricted grants and the old synthetic identity boundary", async () => {
    const client = await owner.pool.connect();
    try {
      expect((await verifyRuntimeGrants(client)).functionChecks).toBe(100);
    } finally {
      client.release();
    }
    const proof = await runtime.pool.query(
      "SELECT public.workflow_identity($1,$2,'local_operation') AS ordinary,public.workflow_identity($1,$2,'synthetic_readiness') AS synthetic,public.has_local_workflow_staff($1,$2,'booking') AS untrusted",
      [parent.id, parent.sessionId],
    );
    expect(proof.rows[0]).toEqual({
      ordinary: true,
      synthetic: false,
      untrusted: false,
    });
    await expect(
      runtime.pool.query(
        "INSERT INTO public.local_workflow_staff(user_id,capabilities,status) VALUES($1,ARRAY['booking'],'active')",
        [parent.id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect((await claim(parent, "booking", randomUUID())).outcome).toBe(
      "forbidden",
    );
  });
  it("creates a pending child without authority and atomically assigns one current MFA reviewer", async () => {
    const made = await runtime.pool.query(
      "SELECT * FROM public.create_learner_admission_with_grade($1,$2,$3,$4,'guardian','Pending local learner','middle_school','UTC',NULL,8)",
      [parent.id, parent.sessionId, randomUUID(), admission.policyId],
    );
    expect(made.rows[0].outcome).toBe("created");
    admissionId = made.rows[0].admission_id;
    learnerId = made.rows[0].learner_id;
    expect(
      (
        await runtime.pool.query(
          "SELECT public.has_current_learner_authority($1,$2,$3,$4) AS allowed",
          [parent.id, parent.sessionId, learnerId, admission.policyId],
        )
      ).rows[0].allowed,
    ).toBe(false);
    const firstKey = randomUUID(),
      secondKey = randomUUID();
    const results = await Promise.all([
      claim(admin, "admission", admissionId, firstKey),
      claim(secondAdmin, "admission", admissionId, secondKey),
    ]);
    expect(results.map((r) => r.outcome).sort()).toEqual(["conflict", "saved"]);
    const winner = results[0].outcome === "saved" ? admin : secondAdmin,
      key = winner === admin ? firstKey : secondKey;
    expect((await claim(winner, "admission", admissionId, key)).outcome).toBe(
      "replayed",
    );
    expect((await claim(winner, "screening", tutorId, key)).outcome).toBe(
      "conflict",
    );
    // Remaining test steps use the actual assigned winner, never rewrite assignment.
    if (winner !== admin) [admin, secondAdmin] = [secondAdmin, admin];
    const row = (
      await owner.pool.query(
        "SELECT source,state FROM public.learner_admissions WHERE id=$1",
        [admissionId],
      )
    ).rows[0];
    expect(row).toEqual({ source: "local_operation", state: "pending" });
  });
  it("requires actual local evidence and assigned review before granting the parent link", async () => {
    let revision = (
      await owner.pool.query(
        "SELECT revision FROM public.learner_admissions WHERE id=$1",
        [admissionId],
      )
    ).rows[0].revision;
    expect(
      (
        await runtime.pool.query(
          "SELECT * FROM public.decide_learner_admission($1,$2,$3,$4,$5,'authorize')",
          [admin.id, admin.sessionId, admissionId, revision, randomUUID()],
        )
      ).rows[0].outcome,
    ).toBe("forbidden");
    for (const code of ["guardian_authority", "guardian_notice"]) {
      const result = await runtime.pool.query(
        "SELECT * FROM public.record_learner_admission_evidence($1,$2,$3,$4,$5,$6,$7)",
        [
          admin.id,
          admin.sessionId,
          admissionId,
          revision,
          randomUUID(),
          code,
          `local:${randomUUID()}`,
        ],
      );
      expect(result.rows[0].outcome).toBe("recorded");
      revision = result.rows[0].revision;
    }
    expect(
      (
        await runtime.pool.query(
          "SELECT * FROM public.decide_learner_admission($1,$2,$3,$4,$5,'authorize')",
          [admin.id, admin.sessionId, admissionId, revision, randomUUID()],
        )
      ).rows[0].outcome,
    ).toBe("decided");
    expect(
      (
        await runtime.pool.query(
          "SELECT public.has_current_learner_authority($1,$2,$3,$4) AS allowed",
          [parent.id, parent.sessionId, learnerId, admission.policyId],
        )
      ).rows[0].allowed,
    ).toBe(true);
    expect(
      (
        await runtime.pool.query(
          "SELECT public.has_current_learner_authority($1,$2,$3,$4) AS allowed",
          [unrelated.id, unrelated.sessionId, learnerId, admission.policyId],
        )
      ).rows[0].allowed,
    ).toBe(false);
    expect(
      (
        await owner.pool.query(
          "SELECT source,status FROM public.guardian_learner_links WHERE learner_id=$1",
          [learnerId],
        )
      ).rows,
    ).toEqual([{ source: "local_operation", status: "authorized" }]);
  });
  it("rejects self-review and revocation completed during an actual domain lock wait", async () => {
    const own = await runtime.pool.query(
      "SELECT * FROM public.create_learner_admission($1,$2,$3,$4,'self','Self review fixture','college_support','UTC',NULL)",
      [admin.id, admin.sessionId, randomUUID(), admission.policyId],
    );
    expect(own.rows[0].outcome).toBe("created");
    expect(
      (await claim(admin, "admission", own.rows[0].admission_id)).outcome,
    ).toBe("not_found");
    expect(
      (
        await runtime.pool.query(
          "SELECT * FROM public.request_tutor_screening($1,$2,$3,$4,$5)",
          [tutor.id, tutor.sessionId, tutorId, randomUUID(), screening.version],
        )
      ).rows[0].outcome,
    ).toBe("saved");
    const blocker = await owner.pool.connect(),
      waiting = await runtime.pool.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT id FROM public.tutor_profiles WHERE id=$1 FOR UPDATE",
        [tutorId],
      );
      const pid = (await waiting.query("SELECT pg_backend_pid() AS pid"))
        .rows[0].pid;
      const pending = claim(
        admin,
        "screening",
        tutorId,
        randomUUID(),
        waiting,
      ).then(
        (result) => ({ result, error: null }),
        (error: unknown) => ({ result: null, error }),
      );
      await waitForLock(pid);
      await owner.pool.query(
        "UPDATE public.user_access SET status='suspended' WHERE user_id=$1",
        [admin.id],
      );
      await blocker.query("COMMIT");
      expect((await pending).error).toMatchObject({ code: "42501" });
      expect(
        (
          await owner.pool.query(
            "SELECT 1 FROM public.tutor_screening_assignments WHERE tutor_id=$1",
            [tutorId],
          )
        ).rowCount,
      ).toBe(0);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      waiting.release();
      await owner.pool.query(
        "UPDATE public.user_access SET status='active' WHERE user_id=$1",
        [admin.id],
      );
    }
  });
  it("requires current passed screening checks before approving ordinary inventory", async () => {
    expect((await claim(admin, "screening", tutorId)).outcome).toBe("saved");
    expect(
      (
        await runtime.pool.query(
          "SELECT * FROM public.decide_tutor_screening($1,$2,$3,0,$4,'approve')",
          [admin.id, admin.sessionId, tutorId, randomUUID()],
        )
      ).rows[0].outcome,
    ).toBe("missing_checks");
    let revision = 0;
    for (const code of screening.requiredCheckCodes) {
      const result = await runtime.pool.query(
        "SELECT * FROM public.record_tutor_screening_check($1,$2,$3,$4,$5,$6,'passed',$7,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '365 days')",
        [
          admin.id,
          admin.sessionId,
          tutorId,
          revision,
          randomUUID(),
          code,
          `screening:${randomUUID()}`,
        ],
      );
      expect(result.rows[0].outcome).toBe("saved");
      revision = result.rows[0].revision;
    }
    expect(
      (
        await runtime.pool.query(
          "SELECT * FROM public.decide_tutor_screening($1,$2,$3,$4,$5,'approve')",
          [admin.id, admin.sessionId, tutorId, revision, randomUUID()],
        )
      ).rows[0].outcome,
    ).toBe("saved");
    expect(
      (
        await runtime.pool.query(
          "SELECT public.has_current_tutor_screening($1,'local_operation') AS ordinary,public.has_current_tutor_screening($1,'synthetic_readiness') AS synthetic",
          [tutorId],
        )
      ).rows[0],
    ).toEqual({ ordinary: true, synthetic: false });
  });
  it.each(["reviewer", "policy"] as const)(
    "rolls back the assignment and events when %s is revoked during a later FK wait",
    async (kind) => {
      const made = await runtime.pool.query(
        "SELECT * FROM public.create_learner_admission($1,$2,$3,$4,'guardian','Blocked claim fixture','middle_school','UTC',NULL)",
        [parent.id, parent.sessionId, randomUUID(), admission.policyId],
      );
      expect(made.rows[0].outcome).toBe("created");
      const target = made.rows[0].admission_id;
      const blocker = await owner.pool.connect(),
        waiting = await runtime.pool.connect();
      try {
        await blocker.query("BEGIN");
        // Strong row lock blocks the assignment's composite reviewer FK after its
        // BEFORE trigger has appended an event. MVCC prechecks still see active.
        await blocker.query(
          "SELECT user_id FROM public.learner_admission_reviewers WHERE user_id=$1 AND source='local_operation' FOR UPDATE",
          [admin.id],
        );
        if (kind === "reviewer")
          await blocker.query(
            "UPDATE public.learner_admission_reviewers SET active=false WHERE user_id=$1 AND source='local_operation'",
            [admin.id],
          );
        const pid = (await waiting.query("SELECT pg_backend_pid() AS pid"))
          .rows[0].pid;
        const request = randomUUID(),
          pending = claim(admin, "admission", target, request, waiting).then(
            (result) => ({ result, error: null }),
            (error: unknown) => ({ result: null, error }),
          );
        await waitForLock(pid);
        if (kind === "policy")
          await owner.pool.query(
            "UPDATE public.learner_admission_policy_state SET enabled=false WHERE source='local_operation'",
          );
        await blocker.query("COMMIT");
        expect((await pending).error).toMatchObject({ code: "42501" });
        expect(
          (
            await owner.pool.query(
              "SELECT 1 FROM public.learner_admission_assignments WHERE admission_id=$1",
              [target],
            )
          ).rowCount,
        ).toBe(0);
        expect(
          (
            await owner.pool.query(
              "SELECT event FROM public.learner_admission_events WHERE admission_id=$1",
              [target],
            )
          ).rows,
        ).toEqual([{ event: "requested" }]);
        expect(
          (
            await owner.pool.query(
              "SELECT 1 FROM public.local_workflow_claims WHERE actor_user_id=$1 AND request_id=$2",
              [admin.id, request],
            )
          ).rowCount,
        ).toBe(0);
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
        waiting.release();
        await owner.pool.query(
          "UPDATE public.learner_admission_reviewers SET active=true WHERE user_id=$1 AND source='local_operation'",
          [admin.id],
        );
        await owner.pool.query(
          "UPDATE public.learner_admission_policy_state SET enabled=true WHERE source='local_operation'",
        );
      }
    },
  );
  it("serializes competing ordinary bookings, preserves retry identity and exact confirmation scope", async () => {
    const second = await authorizeChild(parent),
      start = new Date();
    start.setUTCDate(start.getUTCDate() + 2);
    start.setUTCHours(12, 0, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    const request = (learner: string, key: string) =>
      runtime.pool.query(
        "SELECT * FROM public.create_policy_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,'UTC',$10)",
        [
          parent.id,
          parent.sessionId,
          key,
          booking.policyId,
          learner,
          tutorId,
          subjectId,
          start.toISOString(),
          end.toISOString(),
          "a".repeat(64),
        ],
      );
    const key1 = randomUUID(),
      key2 = randomUUID(),
      results = await Promise.all([
        request(learnerId, key1),
        request(second.learnerId, key2),
      ]);
    expect(results.map((r) => r.rows[0].outcome).sort()).toEqual([
      "conflict",
      "created",
    ]);
    const firstWon = results[0].rows[0].outcome === "created";
    bookingId = results[firstWon ? 0 : 1].rows[0].booking_id;
    const retry = await request(
      firstWon ? learnerId : second.learnerId,
      firstWon ? key1 : key2,
    );
    expect(retry.rows[0]).toMatchObject({
      outcome: "replayed",
      booking_id: bookingId,
    });
    expect((await claim(admin, "booking", bookingId)).outcome).toBe("saved");
    expect(
      (
        await runtime.pool.query(
          "SELECT * FROM public.change_policy_booking($1,$2,$3,$4,$5,0,'confirm','local_prerequisite_review',NULL,NULL,NULL,$6)",
          [
            secondAdmin.id,
            secondAdmin.sessionId,
            bookingId,
            randomUUID(),
            booking.policyId,
            "b".repeat(64),
          ],
        )
      ).rows[0].outcome,
    ).toBe("forbidden");
    const saved = await runtime.pool.query(
      "SELECT * FROM public.change_policy_booking($1,$2,$3,$4,$5,0,'confirm','local_prerequisite_review',NULL,NULL,NULL,$6)",
      [
        admin.id,
        admin.sessionId,
        bookingId,
        randomUUID(),
        booking.policyId,
        "c".repeat(64),
      ],
    );
    expect(saved.rows[0].outcome).toBe("saved");
    expect(
      (
        await owner.pool.query(
          "SELECT source,state FROM public.bookings WHERE id=$1",
          [bookingId],
        )
      ).rows[0],
    ).toEqual({ source: "local_operation", state: "confirmed" });
    expect(
      (
        await runtime.pool.query(
          "SELECT * FROM public.change_policy_booking($1,$2,$3,$4,$5,1,'complete','local_completed',NULL,NULL,NULL,$6)",
          [
            tutor.id,
            tutor.sessionId,
            bookingId,
            randomUUID(),
            booking.policyId,
            "d".repeat(64),
          ],
        )
      ).rows[0].outcome,
    ).toBe("conflict");
  });
  it("rejects local receipt relabels and permits only exact account-support grants", async () => {
    expect((await claim(admin, "account", admin.id)).outcome).toBe("not_found");
    expect((await claim(admin, "account", unrelated.id)).outcome).toBe("saved");
    expect(
      (
        await runtime.pool.query(
          "SELECT * FROM public.change_local_account_access($1,$2,$3,0,'suspended','local_restrict',$4)",
          [secondAdmin.id, secondAdmin.sessionId, unrelated.id, randomUUID()],
        )
      ).rows[0].outcome,
    ).toBe("not_found");
    expect(
      (
        await runtime.pool.query(
          "SELECT * FROM public.change_local_account_access($1,$2,$3,0,'suspended','local_restrict',$4)",
          [admin.id, admin.sessionId, unrelated.id, randomUUID()],
        )
      ).rows[0].outcome,
    ).toBe("saved");
    expect(
      (
        await runtime.pool.query(
          "SELECT * FROM public.change_local_account_access($1,$2,$3,1,'active','local_restore',$4)",
          [admin.id, admin.sessionId, unrelated.id, randomUUID()],
        )
      ).rows[0].outcome,
    ).toBe("saved");
    await expect(
      owner.pool.query(
        "UPDATE public.learner_profiles SET source='synthetic_readiness' WHERE id=$1",
        [learnerId],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    const client = await owner.pool.connect();
    try {
      await client.query("BEGIN");
      await expect(
        prepareLocalStaff(client, unrelated.id),
      ).resolves.toBeUndefined();
      await client.query(
        "UPDATE public.local_workflow_staff SET status='revoked' WHERE user_id=$1",
        [unrelated.id],
      );
      await expect(prepareLocalStaff(client, unrelated.id)).rejects.toThrow(
        "preserved",
      );
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
  async function newChild(
    actor: Actor,
    key = randomUUID(),
    overrides: Record<string, unknown> = {},
  ) {
    const fields = {
      notice: guardian.noticeVersion,
      name: "Attested private learner",
      level: "middle_school",
      grade: 8,
      zone: "UTC",
      next: null,
      declaration: true,
      consent: true,
      ...overrides,
    };
    return (
      await runtime.pool.query(
        "SELECT * FROM public.create_parent_child($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [
          actor.id,
          actor.sessionId,
          key,
          guardian.policyId,
          fields.notice,
          fields.name,
          fields.level,
          fields.grade,
          fields.zone,
          fields.next,
          fields.declaration,
          fields.consent,
        ],
      )
    ).rows[0] as {
      outcome: string;
      admission_id: string;
      learner_id: string;
      revision: number;
    };
  }
  async function newIndependentLearner(
    actor: Actor,
    key = randomUUID(),
    overrides: Record<string, unknown> = {},
  ) {
    const fields = {
      notice: independentAdmission.noticeVersion,
      name: "Self-attested College learner",
      zone: "UTC",
      next: null,
      declaration: true,
      ...overrides,
    };
    return (
      await runtime.pool.query(
        "SELECT * FROM public.create_independent_learner($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          actor.id,
          actor.sessionId,
          key,
          independentAdmission.policyId,
          fields.notice,
          fields.name,
          fields.zone,
          fields.next,
          fields.declaration,
        ],
      )
    ).rows[0] as {
      outcome: string;
      admission_id: string;
      learner_id: string;
    };
  }
  let automatic: Awaited<ReturnType<typeof newChild>>;
  let automaticBooking: { booking_id: string; event_id: string };
  let independent: Awaited<ReturnType<typeof newIndependentLearner>>;
  it("requires both actual declarations and the exact notice without creating partial child data", async () => {
    const before = await owner.pool.query(
      "SELECT count(*)::int n FROM learner_admissions WHERE requester_user_id=$1",
      [parent.id],
    );
    for (const changes of [
      { declaration: false },
      { declaration: null },
      { consent: false },
      { consent: null },
      { notice: "stale" },
      { grade: 13 },
      { grade: 8, level: "college_support" },
      { zone: "Not/AZone" },
    ])
      expect((await newChild(parent, randomUUID(), changes)).outcome).toBe(
        "invalid",
      );
    const after = await owner.pool.query(
      "SELECT count(*)::int n FROM learner_admissions WHERE requester_user_id=$1",
      [parent.id],
    );
    expect(after.rows).toEqual(before.rows);
  });
  it("creates a private active child, link and affirmative immutable origin without staff evidence or assignment", async () => {
    automatic = await newChild(parent);
    expect(automatic.outcome).toBe("created");
    const state = await owner.pool.query(
      "SELECT l.status,a.state,l.grade,(SELECT count(*)::int FROM learner_guardian_attestations t WHERE t.admission_id=a.id AND t.guardian_confirmed AND t.consent_confirmed) attestations,(SELECT count(*)::int FROM learner_admission_evidence e WHERE e.admission_id=a.id) evidence,(SELECT count(*)::int FROM learner_admission_assignments x WHERE x.admission_id=a.id) assignments,(SELECT event FROM learner_admission_events e WHERE e.admission_id=a.id AND revision=0) origin FROM learner_admissions a JOIN learner_profiles l ON l.id=a.learner_id WHERE a.id=$1",
      [automatic.admission_id],
    );
    expect(state.rows[0]).toEqual({
      status: "active",
      state: "authorized",
      grade: 8,
      attestations: 1,
      evidence: 0,
      assignments: 0,
      origin: "guardian_profile_created",
    });
    expect(
      (
        await runtime.pool.query(
          "SELECT has_current_learner_authority($1,$2,$3,$4) owned,has_current_booking_beneficiary($1,$3,$4) beneficiary",
          [
            parent.id,
            parent.sessionId,
            automatic.learner_id,
            guardian.policyId,
          ],
        )
      ).rows[0],
    ).toEqual({ owned: true, beneficiary: true });
  });
  it("serializes same-key child retries, conflicts on changed payload and permits distinct same-name siblings", async () => {
    const key = randomUUID();
    const results = await Promise.all([
      newChild(parent, key),
      newChild(parent, key),
    ]);
    expect(results.map((r) => r.outcome).sort()).toEqual([
      "created",
      "replayed",
    ]);
    expect(new Set(results.map((r) => r.learner_id)).size).toBe(1);
    expect((await newChild(parent, key, { grade: 9 })).outcome).toBe(
      "conflict",
    );
    const sibling = await newChild(parent);
    expect(sibling.outcome).toBe("created");
    expect(sibling.learner_id).not.toBe(automatic.learner_id);
  });
  it("denies foreign edits and raw runtime writes while ordinary owned grade changes need no review", async () => {
    expect(
      (
        await runtime.pool.query(
          "SELECT update_admitted_learner_with_grade($1,$2,$3,$4,'Changed private learner','UTC',9) saved",
          [
            parent.id,
            parent.sessionId,
            automatic.learner_id,
            guardian.policyId,
          ],
        )
      ).rows[0].saved,
    ).toBe(true);
    expect(
      (
        await runtime.pool.query(
          "SELECT update_admitted_learner_with_grade($1,$2,$3,$4,'Foreign learner','UTC',10) saved",
          [
            unrelated.id,
            unrelated.sessionId,
            automatic.learner_id,
            guardian.policyId,
          ],
        )
      ).rows[0].saved,
    ).toBe(false);
    await expect(
      runtime.pool.query(
        "UPDATE learner_guardian_attestations SET consent_confirmed=false WHERE admission_id=$1",
        [automatic.admission_id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      owner.pool.query(
        "UPDATE learner_guardian_attestations SET consent_confirmed=consent_confirmed WHERE admission_id=$1",
        [automatic.admission_id],
      ),
    ).rejects.toMatchObject({ code: "55000" });
    expect(
      (
        await owner.pool.query(
          "SELECT count(*)::int n FROM learner_admission_assignments WHERE admission_id=$1",
          [automatic.admission_id],
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it.each(["unverified", "suspended", "role", "expired"] as const)(
    "denies new child creation and current authority for %s callers",
    async (change) => {
      const commands = {
        unverified: [
          'UPDATE public."user" SET email_verified=false WHERE id=$1',
          'UPDATE public."user" SET email_verified=true WHERE id=$1',
        ],
        suspended: [
          "UPDATE user_access SET status='suspended' WHERE user_id=$1",
          "UPDATE user_access SET status='active' WHERE user_id=$1",
        ],
        role: [
          "DELETE FROM user_roles WHERE user_id=$1 AND role='parent'",
          "INSERT INTO user_roles(user_id,role) VALUES($1,'parent')",
        ],
        expired: [
          "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
          "UPDATE session SET expires_at=clock_timestamp()+interval '1 day' WHERE user_id=$1",
        ],
      };
      await owner.pool.query(commands[change][0], [parent.id]);
      try {
        expect((await newChild(parent)).outcome).toBe("forbidden");
        expect(
          (
            await runtime.pool.query(
              "SELECT has_current_learner_authority($1,$2,$3,$4) allowed",
              [
                parent.id,
                parent.sessionId,
                automatic.learner_id,
                guardian.policyId,
              ],
            )
          ).rows[0].allowed,
        ).toBe(false);
      } finally {
        await owner.pool.query(commands[change][1], [parent.id]);
      }
    },
  );
  it("creates exactly one confirmed parent booking under overlap races and replays its confirmation event", async () => {
    const child2 = await newChild(parent),
      start = new Date();
    start.setUTCDate(start.getUTCDate() + 3);
    start.setUTCHours(11, 0, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    const create = (child: string, key: string) =>
      runtime.pool.query(
        "SELECT * FROM create_policy_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,'UTC',$10)",
        [
          parent.id,
          parent.sessionId,
          key,
          parentBooking.policyId,
          child,
          tutorId,
          subjectId,
          start.toISOString(),
          end.toISOString(),
          "e".repeat(64),
        ],
      );
    const keys = [randomUUID(), randomUUID()],
      children = [automatic.learner_id, child2.learner_id];
    const outcomes = await Promise.all(
      children.map((c, i) => create(c, keys[i])),
    );
    expect(outcomes.map((r) => r.rows[0].outcome).sort()).toEqual([
      "conflict",
      "created",
    ]);
    const winner = outcomes.findIndex((r) => r.rows[0].outcome === "created");
    automaticBooking = outcomes[winner].rows[0];
    const record = (
      await owner.pool.query(
        "SELECT b.state,b.admission_policy_id,e.event,e.reason_code,(SELECT count(*)::int FROM booking_workflow_notice_intents i WHERE i.event_id=e.id) notices,(SELECT count(*)::int FROM booking_workflow_grants g WHERE g.logical_booking_id=b.logical_booking_id) grants FROM bookings b JOIN booking_lifecycle_events e ON e.booking_id=b.id WHERE b.id=$1",
        [automaticBooking.booking_id],
      )
    ).rows[0];
    expect(record).toEqual({
      state: "confirmed",
      admission_policy_id: guardian.policyId,
      event: "workflow_confirmed",
      reason_code: "local_parent_booking",
      notices: 2,
      grants: 0,
    });
    expect(
      (await create(children[winner], keys[winner])).rows[0],
    ).toMatchObject({ ...automaticBooking, outcome: "replayed" });
    expect(
      (await claim(admin, "booking", automaticBooking.booking_id)).outcome,
    ).toBe("not_found");
    await expect(
      runtime.pool.query(
        "SELECT assert_booking_workflow_receipt($1,$2,b.id,$3,'create',b.workflow_policy_id,false,b.state,b.expires_at,b.start_at_utc,b.end_at_utc) FROM bookings b WHERE b.id=$4",
        [
          parent.id,
          parent.sessionId,
          automaticBooking.event_id,
          automaticBooking.booking_id,
        ],
      ),
    ).resolves.toBeDefined();
  });
  it("keeps v1 heads and pending historical requests intact when guardian-v2 is disabled", async () => {
    await owner.pool.query(
      "UPDATE learner_admission_policy_state SET enabled=false WHERE current_policy_id=$1",
      [guardian.policyId],
    );
    try {
      expect((await newChild(parent)).outcome).toBe("policy_unavailable");
      expect(
        (
          await runtime.pool.query(
            "SELECT booking_workflow_policy_current($1) parent,booking_workflow_policy_current($2) legacy,admission_policy_current($3) admission",
            [parentBooking.policyId, booking.policyId, admission.policyId],
          )
        ).rows[0],
      ).toEqual({ parent: false, legacy: true, admission: true });
    } finally {
      await owner.pool.query(
        "UPDATE learner_admission_policy_state SET enabled=true WHERE current_policy_id=$1",
        [guardian.policyId],
      );
    }
    expect(
      (
        await owner.pool.query(
          "SELECT policy_id FROM booking_workflow_policy_head WHERE source='local_operation'",
        )
      ).rows[0].policy_id,
    ).toBe(booking.policyId);
    expect(
      (
        await runtime.pool.query(
          "SELECT * FROM create_learner_admission_with_grade($1,$2,$3,$4,'guardian','Historical pending child','middle_school','UTC',NULL,8)",
          [parent.id, parent.sessionId, randomUUID(), admission.policyId],
        )
      ).rows[0].outcome,
    ).toBe("created");
  });
  it("requires exact assigned booking-support scope before exceptional relationship revocation", async () => {
    expect(
      (
        await runtime.pool.query(
          "SELECT * FROM claim_guardian_admission_exception($1,$2,$3,$4,$5)",
          [
            admin.id,
            admin.sessionId,
            automatic.admission_id,
            randomUUID(),
            randomUUID(),
          ],
        )
      ).rows[0].outcome,
    ).toBe("forbidden");
    const child = (
      await owner.pool.query(
        "SELECT a.id FROM learner_admissions a JOIN bookings b ON b.learner_id=a.learner_id WHERE b.id=$1",
        [automaticBooking.booking_id],
      )
    ).rows[0].id as string;
    const caseId = randomUUID(),
      client = await owner.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO support_cases(id,requester_user_id,request_key,source,category,subject,body) VALUES($1,$2,$3,'local_operation','safety','Fixture guardian access dispute','Fixture exact support scope')",
        [caseId, parent.id, randomUUID()],
      );
      await client.query(
        "INSERT INTO support_case_events(case_id,action,revision,actor_user_id,next_status) VALUES($1,'created',0,$2,'open')",
        [caseId, parent.id],
      );
      await client.query(
        "INSERT INTO support_case_bookings(case_id,booking_id) VALUES($1,$2)",
        [caseId, automaticBooking.booking_id],
      );
      await client.query("COMMIT");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    expect((await claim(admin, "support", caseId)).outcome).toBe("saved");
    // Observe a real FK wait after the initial support scope read. Revoking
    // the independent support reviewer must roll back every assignment effect.
    const blocker = await owner.pool.connect();
    const waiting = await runtime.pool.connect();
    const waitingKey = randomUUID();
    let pending: Promise<{ error?: unknown }> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT user_id FROM learner_admission_reviewers WHERE user_id=$1 AND source='local_operation' FOR UPDATE",
        [admin.id],
      );
      const pid = (await waiting.query("SELECT pg_backend_pid() pid")).rows[0]
        .pid as number;
      pending = waiting
        .query(
          "SELECT * FROM claim_guardian_admission_exception($1,$2,$3,$4,$5)",
          [admin.id, admin.sessionId, child, caseId, waitingKey],
        )
        .then(
          () => ({}),
          (error: unknown) => ({ error }),
        );
      await waitForLock(pid);
      await owner.pool.query(
        "UPDATE support_reviewers SET status='revoked' WHERE user_id=$1",
        [admin.id],
      );
      await blocker.query("COMMIT");
      expect((await pending).error).toMatchObject({ code: "42501" });
      expect(
        (
          await owner.pool.query(
            "SELECT count(*)::int n FROM learner_admission_assignments WHERE admission_id=$1",
            [child],
          )
        ).rows[0].n,
      ).toBe(0);
      expect(
        (
          await owner.pool.query(
            "SELECT count(*)::int n FROM local_workflow_claims WHERE actor_user_id=$1 AND request_id=$2",
            [admin.id, waitingKey],
          )
        ).rows[0].n,
      ).toBe(0);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      await pending;
      waiting.release();
      await owner.pool.query(
        "UPDATE support_reviewers SET status='authorized' WHERE user_id=$1",
        [admin.id],
      );
    }
    const key = randomUUID();
    expect(
      (
        await runtime.pool.query(
          "SELECT * FROM claim_guardian_admission_exception($1,$2,$3,$4,$5)",
          [admin.id, admin.sessionId, child, caseId, key],
        )
      ).rows[0].outcome,
    ).toBe("saved");
    expect(
      (
        await owner.pool.query(
          "SELECT guardian_case_id FROM local_workflow_claims WHERE actor_user_id=$1 AND request_id=$2",
          [admin.id, key],
        )
      ).rows[0].guardian_case_id,
    ).toBe(caseId);
    const revision = (
      await owner.pool.query(
        "SELECT revision FROM learner_admissions WHERE id=$1",
        [child],
      )
    ).rows[0].revision;
    expect(
      (
        await runtime.pool.query(
          "SELECT * FROM decide_learner_admission($1,$2,$3,$4,$5,'revoke')",
          [admin.id, admin.sessionId, child, revision, randomUUID()],
        )
      ).rows[0].outcome,
    ).toBe("decided");
    expect(
      (
        await owner.pool.query(
          "SELECT a.state,l.status,g.status AS link FROM learner_admissions a JOIN learner_profiles l ON l.id=a.learner_id JOIN guardian_learner_links g ON g.learner_id=l.id WHERE a.id=$1",
          [child],
        )
      ).rows[0],
    ).toEqual({ state: "revoked", status: "inactive", link: "revoked" });
    expect(
      (
        await owner.pool.query(
          "SELECT count(*)::int n FROM learner_guardian_attestations WHERE admission_id=$1",
          [child],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("atomically creates one self-attested College learner and immutable trusted Student authority", async () => {
    const before = await owner.pool.query(
      "SELECT count(*)::int n FROM learner_profiles WHERE user_id=$1",
      [unrelated.id],
    );
    for (const changes of [
      { declaration: false },
      { declaration: null },
      { notice: "stale" },
      { zone: "Not/AZone" },
      { name: " changed " },
    ])
      expect(
        (await newIndependentLearner(unrelated, randomUUID(), changes)).outcome,
      ).toBe("invalid");
    expect(
      (
        await owner.pool.query(
          "SELECT count(*)::int n FROM learner_profiles WHERE user_id=$1",
          [unrelated.id],
        )
      ).rows,
    ).toEqual(before.rows);

    const key = randomUUID();
    const created = await Promise.all([
      newIndependentLearner(unrelated, key),
      newIndependentLearner(unrelated, key),
    ]);
    expect(created.map((row) => row.outcome).sort()).toEqual([
      "created",
      "replayed",
    ]);
    expect(new Set(created.map((row) => row.learner_id)).size).toBe(1);
    independent = created.find((row) => row.outcome === "created")!;
    expect(
      await newIndependentLearner(unrelated, key, { name: "Changed replay" }),
    ).toMatchObject({ outcome: "conflict" });
    expect(await newIndependentLearner(unrelated)).toMatchObject({
      outcome: "exists",
    });

    const state = await owner.pool.query(
      `SELECT l.management,l.level,l.status,a.state,t.eligibility_declared,t.verification_status,
        (SELECT count(*)::int FROM learner_admission_events e WHERE e.admission_id=a.id AND e.event='independent_profile_created' AND e.revision=0) origins,
        (SELECT count(*)::int FROM learner_admission_assignments x WHERE x.admission_id=a.id) assignments,
        (SELECT count(*)::int FROM learner_admission_evidence e WHERE e.admission_id=a.id) evidence,
        (SELECT count(*)::int FROM user_roles r WHERE r.user_id=$2 AND r.role='student') roles,
        (SELECT count(*)::int FROM audit_events ae WHERE ae.actor_user_id=$2 AND ae.target_user_id=$2 AND ae.action='student_role.self_granted') audits
       FROM learner_profiles l JOIN learner_admissions a ON a.learner_id=l.id
       JOIN learner_independent_attestations t ON t.admission_id=a.id WHERE l.id=$1`,
      [independent.learner_id, unrelated.id],
    );
    expect(state.rows[0]).toEqual({
      management: "self",
      level: "college_support",
      status: "active",
      state: "authorized",
      eligibility_declared: true,
      verification_status: "self_attested_unverified",
      origins: 1,
      assignments: 0,
      evidence: 0,
      roles: 1,
      audits: 1,
    });
    expect(
      (
        await runtime.pool.query(
          "SELECT has_current_learner_authority($1,$2,$3,$4) allowed",
          [
            unrelated.id,
            unrelated.sessionId,
            independent.learner_id,
            independentAdmission.policyId,
          ],
        )
      ).rows[0].allowed,
    ).toBe(true);
    await expect(
      runtime.pool.query(
        "UPDATE learner_independent_attestations SET eligibility_declared=false WHERE admission_id=$1",
        [independent.admission_id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      owner.pool.query(
        "UPDATE learner_independent_attestations SET eligibility_declared=eligibility_declared WHERE admission_id=$1",
        [independent.admission_id],
      ),
    ).rejects.toMatchObject({ code: "55000" });
  });
  it.each(["unverified", "suspended", "role", "expired"] as const)(
    "denies current independent authority when %s",
    async (change) => {
      const commands = {
        unverified: [
          'UPDATE public."user" SET email_verified=false WHERE id=$1',
          'UPDATE public."user" SET email_verified=true WHERE id=$1',
        ],
        suspended: [
          "UPDATE user_access SET status='suspended' WHERE user_id=$1",
          "UPDATE user_access SET status='active' WHERE user_id=$1",
        ],
        role: [
          "DELETE FROM user_roles WHERE user_id=$1 AND role='student'",
          "INSERT INTO user_roles(user_id,role) VALUES($1,'student')",
        ],
        expired: [
          "UPDATE session SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$2 AND user_id=$1",
          "UPDATE session SET expires_at=clock_timestamp()+interval '1 day' WHERE id=$2 AND user_id=$1",
        ],
      };
      const parameters =
        change === "expired"
          ? [unrelated.id, unrelated.sessionId]
          : [unrelated.id];
      await owner.pool.query(commands[change][0], parameters);
      try {
        expect(
          (
            await runtime.pool.query(
              "SELECT has_current_learner_authority($1,$2,$3,$4) allowed",
              [
                unrelated.id,
                unrelated.sessionId,
                independent.learner_id,
                independentAdmission.policyId,
              ],
            )
          ).rows[0].allowed,
        ).toBe(false);
      } finally {
        await owner.pool.query(commands[change][1], parameters);
      }
    },
  );
  it("denies a disabled independent policy while preserving its receipt", async () => {
    await owner.pool.query(
      "UPDATE learner_admission_policy_state SET enabled=false WHERE current_policy_id=$1",
      [independentAdmission.policyId],
    );
    try {
      expect(await newIndependentLearner(unrelated)).toMatchObject({
        outcome: "policy_unavailable",
      });
      expect(
        (
          await owner.pool.query(
            "SELECT count(*)::int n FROM learner_independent_attestations WHERE admission_id=$1",
            [independent.admission_id],
          )
        ).rows[0].n,
      ).toBe(1);
    } finally {
      await owner.pool.query(
        "UPDATE learner_admission_policy_state SET enabled=true WHERE current_policy_id=$1",
        [independentAdmission.policyId],
      );
    }
  });
  it("creates one direct confirmed no-money booking for the authorized Student under an overlap race", async () => {
    await owner.pool.query(
      "UPDATE tutor_subjects SET levels=array_append(levels,'college_support') WHERE tutor_id=$1 AND subject_id=$2 AND NOT levels@>ARRAY['college_support']::text[]",
      [tutorId, subjectId],
    );
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 10);
    start.setUTCHours(12, 0, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    const create = (key: string, actor = unrelated) =>
      runtime.pool.query(
        "SELECT * FROM create_policy_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,'UTC',$10)",
        [
          actor.id,
          actor.sessionId,
          key,
          independentBookingPolicy.policyId,
          independent.learner_id,
          tutorId,
          subjectId,
          start.toISOString(),
          end.toISOString(),
          "f".repeat(64),
        ],
      );
    const keys = [randomUUID(), randomUUID()];
    const attempts = await Promise.all(keys.map((key) => create(key)));
    expect(attempts.map((result) => result.rows[0].outcome).sort()).toEqual([
      "conflict",
      "created",
    ]);
    const winner = attempts.findIndex(
      (result) => result.rows[0].outcome === "created",
    );
    const saved = attempts[winner].rows[0] as {
      booking_id: string;
      event_id: string;
    };
    expect((await create(keys[winner])).rows[0]).toMatchObject({
      ...saved,
      outcome: "replayed",
    });
    expect((await create(randomUUID(), parent)).rows[0].outcome).toBe(
      "forbidden",
    );
    expect(
      (
        await owner.pool.query(
          `SELECT b.state,b.workflow_policy_id,b.admission_policy_id,e.event,e.reason_code,
            (SELECT count(*)::int FROM booking_workflow_notice_intents i WHERE i.event_id=e.id) notices,
            (SELECT count(*)::int FROM booking_workflow_grants g WHERE g.logical_booking_id=b.logical_booking_id) grants
           FROM bookings b JOIN booking_lifecycle_events e ON e.booking_id=b.id WHERE b.id=$1`,
          [saved.booking_id],
        )
      ).rows[0],
    ).toEqual({
      state: "confirmed",
      workflow_policy_id: independentBookingPolicy.policyId,
      admission_policy_id: independentAdmission.policyId,
      event: "workflow_confirmed",
      reason_code: "local_independent_booking",
      notices: 2,
      grants: 0,
    });
    expect((await claim(admin, "booking", saved.booking_id)).outcome).toBe(
      "not_found",
    );
    await expect(
      runtime.pool.query(
        "SELECT assert_booking_workflow_receipt($1,$2,b.id,$3,'create',b.workflow_policy_id,false,b.state,b.expires_at,b.start_at_utc,b.end_at_utc) FROM bookings b WHERE b.id=$4",
        [unrelated.id, unrelated.sessionId, saved.event_id, saved.booking_id],
      ),
    ).resolves.toBeDefined();
  });
});
