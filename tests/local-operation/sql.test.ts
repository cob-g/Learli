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
import { localAdmissionPolicy as admission } from "@/features/learner-admission/policy";
import { localBookingPolicy as booking } from "@/features/booking-workflows/policy";
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
      expect((await verifyRuntimeGrants(client)).functionChecks).toBe(95);
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
});
