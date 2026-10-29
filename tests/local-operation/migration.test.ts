import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { describe, expect, it } from "vitest";
import { createDatabase } from "@/lib/db/connection";
import { loadCandidate } from "../../scripts/staging-migrations/journal";
import {
  runtimeGrantsBeforeOperation,
  runtimeGrantsBeforeAutomaticChildren,
  runtimeGrantsBeforeIndependent,
} from "../support/migration-inventory";
import { runtimeGrantsSql } from "../../scripts/runtime-grants";
import {
  localAdmissionPolicy,
  localGuardianAdmissionPolicy,
} from "@/features/learner-admission/policy";
import { localBookingPolicy } from "@/features/booking-workflows/policy";
import { prepareLocalStaff } from "../../scripts/local-workflow";
import { verifyRuntimeGrants } from "../../scripts/staging-migrations/privileges";
import { verifyProtections } from "../../scripts/staging-migrations/protections";
import { operationFixtureConfiguration } from "./support";

async function records(client: PoolClient, columns?: Record<string, string[]>) {
  const projection: Record<string, string[]> =
    columns ??
    Object.fromEntries(
      (
        await client.query(
          "SELECT table_name,array_agg(column_name::text ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name ORDER BY table_name",
        )
      ).rows.map((r) => [r.table_name, r.columns]),
    );
  const rows: Record<string, unknown> = {};
  for (const [table, names] of Object.entries(projection)) {
    if (!/^[a-z_]+$/.test(table) || names.some((n) => !/^\w+$/.test(n)))
      throw new Error("Invalid fixture projection.");
    rows[table] = (
      await client.query(
        `SELECT to_jsonb(t) AS row FROM(SELECT ${names.map((n) => `"${n}"`).join(",")} FROM public."${table}") t ORDER BY to_jsonb(t)::text`,
      )
    ).rows;
  }
  return { columns: projection, rows };
}
/** Historical owner-created prerequisites only; actual provider MFA is exercised
 * separately by workflow-services. All fixture writes retain the real guards. */
async function legacyAdmissionMatrix(client: PoolClient) {
  const account = async (name: string) => {
    const id = randomUUID(),
      session = randomUUID();
    await client.query(
      'INSERT INTO public."user"(id,name,email,email_verified) VALUES($1,$2,$3,true)',
      [id, name, `${id}@learli.test`],
    );
    await client.query("INSERT INTO user_access(user_id) VALUES($1)", [id]);
    await client.query(
      "INSERT INTO session(id,user_id,token,expires_at,created_at,updated_at) VALUES($1,$2,$3,now()+interval '1 day',now(),now())",
      [session, id, randomUUID()],
    );
    return { id, session };
  };
  const reviewer = await account("Historical fictional reviewer"),
    foreign = await account("Unrelated fictional requester"),
    tutor = await account("Historical fictional tutor"),
    factor = randomUUID(),
    policy = localAdmissionPolicy;
  await client.query("BEGIN");
  try {
    await prepareLocalStaff(client, reviewer.id);
    await client.query(
      'UPDATE public."user" SET two_factor_enabled=true WHERE id=$1',
      [reviewer.id],
    );
    await client.query(
      "INSERT INTO two_factor(id,user_id,secret,backup_codes,verified) VALUES($1,$2,'historical-fixture-only','[]',true)",
      [factor, reviewer.id],
    );
    await client.query(
      "INSERT INTO admin_security_epochs(user_id) VALUES($1) ON CONFLICT DO NOTHING",
      [reviewer.id],
    );
    await client.query(
      "INSERT INTO admin_assurance_receipts(session_id,user_id,factor_id,epoch,role_granted_at,method) SELECT $1,$2,$3,e.epoch,r.granted_at,'totp' FROM admin_security_epochs e JOIN user_roles r ON r.user_id=e.user_id AND r.role='admin' WHERE e.user_id=$2",
      [reviewer.session, reviewer.id, factor],
    );
    await client.query("COMMIT");
  } finally {
    await client.query("ROLLBACK");
  }
  await client.query(
    `INSERT INTO learner_admission_policies(id,source,authority,version,reference,market_code,content_digest,notice_version,guardian_proof_method,independent_eligibility_rule,reviewer_capability_code,revocation_effect)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      policy.policyId,
      policy.source,
      policy.authority,
      policy.version,
      policy.reference,
      policy.marketCode,
      policy.contentDigest,
      policy.noticeVersion,
      policy.guardianProofMethod,
      policy.independentEligibilityRule,
      policy.reviewerCapabilityCode,
      policy.revocationEffect,
    ],
  );
  await client.query(
    "INSERT INTO learner_admission_policy_state(source,market_code,current_policy_id,enabled) VALUES($1,$2,$3,true)",
    [policy.source, policy.marketCode, policy.policyId],
  );
  await client.query(
    "INSERT INTO booking_workflow_policies(id,version,reference,content_digest,terms) VALUES($1,$2,$3,$4,$5)",
    [
      localBookingPolicy.policyId,
      localBookingPolicy.version,
      localBookingPolicy.reference,
      localBookingPolicy.contentDigest,
      localBookingPolicy,
    ],
  );
  await client.query(
    "INSERT INTO booking_workflow_policy_head(source,policy_id,enabled) VALUES('local_operation',$1,true)",
    [localBookingPolicy.policyId],
  );
  const profile = (
    await client.query(
      "INSERT INTO tutor_profiles(user_id,slug,headline,bio,teaching_background,timezone) VALUES($1,$2,'Historical tutor','Fictional migration fixture','Fictional fixture only','Asia/Manila') RETURNING id",
      [tutor.id, `historical-${randomUUID()}`],
    )
  ).rows[0].id as string;
  const subject = (
    await client.query("SELECT id FROM subjects WHERE slug='math'")
  ).rows[0].id as string;
  const fixtures: {
    id: string;
    learnerId: string;
    actor: Awaited<ReturnType<typeof account>>;
    management: "self" | "guardian";
    state: "pending" | "authorized" | "rejected" | "revoked";
  }[] = [];
  for (const management of ["self", "guardian"] as const) {
    for (const state of [
      "pending",
      "authorized",
      "rejected",
      "revoked",
    ] as const) {
      const actor = await account(`Historical ${management} ${state}`);
      const created = (
        await client.query(
          "SELECT * FROM create_learner_admission($1,$2,$3,$4,$5,$6,$7,'Asia/Manila',NULL)",
          [
            actor.id,
            actor.session,
            randomUUID(),
            policy.policyId,
            management,
            `Preserved ${management} ${state}`,
            management === "self" ? "college_support" : "middle_school",
          ],
        )
      ).rows[0];
      expect(created.outcome).toBe("created");
      const id = created.admission_id as string,
        learnerId = created.learner_id as string;
      await client.query(
        "INSERT INTO learner_admission_assignments(admission_id,reviewer_user_id,source,capability_code) VALUES($1,$2,'local_operation','learner_admission_review')",
        [id, reviewer.id],
      );
      let revision = (
        await client.query(
          "SELECT revision FROM learner_admissions WHERE id=$1",
          [id],
        )
      ).rows[0].revision as number;
      for (const check of management === "self"
        ? ["independent_eligibility"]
        : ["guardian_authority", "guardian_notice"]) {
        const evidence = (
          await client.query(
            "SELECT * FROM record_learner_admission_evidence($1,$2,$3,$4,$5,$6,$7)",
            [
              reviewer.id,
              reviewer.session,
              id,
              revision,
              randomUUID(),
              check,
              `local:${randomUUID()}`,
            ],
          )
        ).rows[0];
        expect(evidence.outcome).toBe("recorded");
        revision = evidence.revision;
      }
      const decide = async (action: string) => {
        const result = (
          await client.query(
            "SELECT * FROM decide_learner_admission($1,$2,$3,$4,$5,$6)",
            [reviewer.id, reviewer.session, id, revision, randomUUID(), action],
          )
        ).rows[0];
        expect(result.outcome).toBe("decided");
        revision = result.revision;
      };
      if (state === "rejected") await decide("reject");
      if (state === "authorized" || state === "revoked") {
        await decide("authorize");
        // A real pre-v2 provisional/confirmation history, created while authority
        // exists. The later revocation must retain these original records.
        const booking = randomUUID(),
          key = randomUUID();
        await client.query("BEGIN");
        try {
          await client.query(
            "INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,created_at,expires_at,workflow_policy_id,admission_policy_id) VALUES($1,'local_operation',$2,$3,$4,$5,clock_timestamp()+interval '2 days'+$9::integer*interval '2 hours',clock_timestamp()+interval '2 days'+$9::integer*interval '2 hours'+interval '1 hour','Asia/Manila',$6,repeat('a',64),'provisional',clock_timestamp(),clock_timestamp()+interval '10 minutes',$7,$8)",
            [
              booking,
              profile,
              learnerId,
              actor.id,
              subject,
              key,
              localBookingPolicy.policyId,
              policy.policyId,
              fixtures.length,
            ],
          );
          await client.query(
            "INSERT INTO booking_lifecycle_events(logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code) VALUES($1,$1,$2,'workflow_provisional',$3,repeat('a',64),clock_timestamp(),$4,0,'local_request')",
            [booking, actor.id, key, localBookingPolicy.policyId],
          );
          if (management === "guardian" || state === "revoked") {
            await client.query(
              "UPDATE bookings SET state='confirmed',workflow_revision=1 WHERE id=$1",
              [booking],
            );
            await client.query(
              "INSERT INTO booking_lifecycle_events(logical_booking_id,booking_id,actor_user_id,event,request_id,request_fingerprint,created_at,workflow_policy_id,workflow_revision,reason_code) VALUES($1,$1,$2,'workflow_confirmed',$3,repeat('b',64),clock_timestamp(),$4,1,'local_prerequisite_review')",
              [booking, reviewer.id, randomUUID(), localBookingPolicy.policyId],
            );
          }
          await client.query("COMMIT");
        } finally {
          await client.query("ROLLBACK");
        }
        if (state === "revoked") await decide("revoke");
      }
      fixtures.push({ id, learnerId, actor, management, state });
    }
  }
  const access = async () =>
    (
      await client.query(
        `SELECT a.id,a.management,a.state,l.status,
    public.has_current_learner_authority(a.requester_user_id,s.id,l.id,a.policy_id) AS owner_access,
    public.has_current_booking_beneficiary(a.requester_user_id,l.id,a.policy_id) AS beneficiary,
    public.has_current_learner_authority($2,$3,l.id,a.policy_id) AS foreign_access,
    public.admission_reviewer_allowed($4,$5,a.id) AS assigned_review,
    (SELECT g.status FROM guardian_learner_links g WHERE g.learner_id=l.id) AS guardian_status,
    (SELECT count(*)::int FROM learner_admission_evidence e WHERE e.admission_id=a.id) AS evidence,
    (SELECT count(*)::int FROM learner_admission_events e WHERE e.admission_id=a.id) AS events,
    (SELECT count(*)::int FROM bookings b WHERE b.learner_id=l.id) AS bookings,
    (SELECT bool_and(public.booking_workflow_policy_current(b.workflow_policy_id)) FROM bookings b WHERE b.learner_id=l.id) AS booking_policy_current,
    (SELECT bool_and(public.has_current_booking_beneficiary(b.booked_by_user_id,b.learner_id,b.admission_policy_id)) FROM bookings b WHERE b.learner_id=l.id) AS booking_beneficiary
    FROM learner_admissions a JOIN learner_profiles l ON l.id=a.learner_id JOIN session s ON s.user_id=a.requester_user_id
    WHERE a.id=ANY($1::uuid[]) ORDER BY a.id`,
        [
          fixtures.map((f) => f.id),
          foreign.id,
          foreign.session,
          reviewer.id,
          reviewer.session,
        ],
      )
    ).rows;
  const before = await access();
  expect(before).toHaveLength(8);
  for (const fixture of fixtures) {
    const row = before.find((r) => r.id === fixture.id);
    const hasBooking =
      fixture.state === "authorized" || fixture.state === "revoked";
    expect(row).toEqual({
      id: fixture.id,
      management: fixture.management,
      state: fixture.state,
      status: fixture.state === "authorized" ? "active" : "inactive",
      owner_access: fixture.state === "authorized",
      beneficiary: fixture.state === "authorized",
      foreign_access: false,
      assigned_review: true,
      guardian_status:
        fixture.management === "guardian" && hasBooking ? fixture.state : null,
      evidence: fixture.management === "guardian" ? 2 : 1,
      events:
        (fixture.management === "guardian" ? 4 : 3) +
        (fixture.state === "pending" ? 0 : fixture.state === "revoked" ? 2 : 1),
      bookings: hasBooking ? 1 : 0,
      booking_policy_current: hasBooking ? true : null,
      booking_beneficiary: hasBooking ? fixture.state === "authorized" : null,
    });
  }
  expect(
    (await client.query("SELECT count(*)::int n FROM booking_lifecycle_events"))
      .rows[0].n,
  ).toBe(7);
  const reviewActions = async () => {
    for (const fixture of fixtures) {
      await client.query("BEGIN");
      try {
        const revision = (
          await client.query(
            "SELECT revision FROM learner_admissions WHERE id=$1",
            [fixture.id],
          )
        ).rows[0].revision as number;
        const action = fixture.state === "authorized" ? "revoke" : "authorize";
        expect(
          (
            await client.query(
              "SELECT * FROM decide_learner_admission($1,$2,$3,$4,$5,$6)",
              [
                foreign.id,
                foreign.session,
                fixture.id,
                revision,
                randomUUID(),
                action,
              ],
            )
          ).rows[0].outcome,
        ).toBe("forbidden");
        expect(
          (
            await client.query(
              "SELECT * FROM decide_learner_admission($1,$2,$3,$4,$5,$6)",
              [
                reviewer.id,
                reviewer.session,
                fixture.id,
                revision,
                randomUUID(),
                action,
              ],
            )
          ).rows[0].outcome,
        ).toBe(
          fixture.state === "pending" || fixture.state === "authorized"
            ? "decided"
            : "conflict",
        );
      } finally {
        await client.query("ROLLBACK");
      }
    }
  };
  await reviewActions();
  return { before, access, reviewActions };
}
describe("0035–0039 ordinary operation forward migration preservation", () => {
  it.each([
    "fresh",
    "populated0034",
    "populated0037",
    "populated0038",
  ] as const)(
    "preserves %s data and exact runtime protections",
    async (mode) => {
      const configuration = operationFixtureConfiguration(),
        root = configuration.checkout;
      const candidate = loadCandidate(root),
        owner = createDatabase(configuration.ownerUrl);
      const database = `learli_operation_${randomUUID().replaceAll("-", "")}`;
      let pool: Pool | undefined,
        created = false;
      const directory = await mkdtemp(
        path.join(tmpdir(), "learli-operation-baseline-"),
      );
      try {
        await owner.pool.query(
          `CREATE DATABASE ${database} OWNER learli_owner`,
        );
        created = true;
        await owner.pool.query(
          `REVOKE ALL ON DATABASE ${database} FROM PUBLIC;GRANT CONNECT ON DATABASE ${database} TO learli_app`,
        );
        pool = new Pool({
          ...owner.pool.options,
          // pg deliberately makes passwords non-enumerable on Pool.options.
          password: owner.pool.options.password,
          database,
          max: 1,
          statement_timeout: 15000,
        });
        const client = await pool.connect();
        try {
          let before: Awaited<ReturnType<typeof records>> | undefined;
          let legacy:
            Awaited<ReturnType<typeof legacyAdmissionMatrix>> | undefined;
          if (mode !== "fresh") {
            const prefix =
              mode === "populated0038"
                ? 39
                : mode === "populated0037"
                  ? 38
                  : 35;
            await mkdir(path.join(directory, "meta"), { mode: 0o700 });
            const journal = JSON.parse(
              await readFile(
                path.join(root, "drizzle/meta/_journal.json"),
                "utf8",
              ),
            );
            await writeFile(
              path.join(directory, "meta/_journal.json"),
              JSON.stringify({
                ...journal,
                entries: journal.entries.slice(0, prefix),
              }),
              { mode: 0o600 },
            );
            for (const entry of candidate.entries.slice(0, prefix))
              await writeFile(
                path.join(directory, `${entry.tag}.sql`),
                await readFile(path.join(root, "drizzle", `${entry.tag}.sql`)),
                { mode: 0o600 },
              );
            await migrate(drizzle(client), { migrationsFolder: directory });
            await client.query(
              mode === "populated0038"
                ? runtimeGrantsBeforeIndependent
                : mode === "populated0037"
                  ? runtimeGrantsBeforeAutomaticChildren
                  : runtimeGrantsBeforeOperation,
            );
            const actor = randomUUID(),
              session = randomUUID();
            await client.query(
              "INSERT INTO public.\"user\"(id,name,email,email_verified) VALUES($1,'Preserved fictional guardian',$2,true)",
              [actor, `${actor}@learli.test`],
            );
            await client.query(
              "INSERT INTO public.user_access(user_id) VALUES($1)",
              [actor],
            );
            await client.query(
              "INSERT INTO public.user_roles(user_id,role) VALUES($1,'parent')",
              [actor],
            );
            await client.query(
              "INSERT INTO public.session(id,user_id,token,expires_at,created_at,updated_at) VALUES($1,$2,$3,now()+interval '1 day',now(),now())",
              [session, actor, randomUUID()],
            );
            expect(
              (
                await client.query(
                  "SELECT * FROM public.create_local_learner_with_grade($1,$2,$3,'guardian','Preserved child','middle_school','Asia/Manila',8)",
                  [actor, session, randomUUID()],
                )
              ).rows[0].outcome,
            ).toBe("created");
            if (mode === "populated0038") {
              legacy = await legacyAdmissionMatrix(client);
              const policy = localGuardianAdmissionPolicy;
              await client.query(
                `INSERT INTO public.learner_admission_policies(id,source,authority,version,reference,market_code,content_digest,notice_version,guardian_proof_method,independent_eligibility_rule,reviewer_capability_code,revocation_effect)
                 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
                [
                  policy.policyId,
                  policy.source,
                  policy.authority,
                  policy.version,
                  policy.reference,
                  policy.marketCode,
                  policy.contentDigest,
                  policy.noticeVersion,
                  policy.guardianProofMethod,
                  policy.independentEligibilityRule,
                  policy.reviewerCapabilityCode,
                  policy.revocationEffect,
                ],
              );
              await client.query(
                "INSERT INTO public.learner_admission_policy_state(source,market_code,current_policy_id,enabled) VALUES('local_operation','local_guardian_creation',$1,true)",
                [policy.policyId],
              );
              expect(
                (
                  await client.query(
                    "SELECT * FROM public.create_parent_child($1,$2,$3,$4,$5,'Preserved automatic child','middle_school',8,'Asia/Manila',NULL,true,true)",
                    [
                      actor,
                      session,
                      randomUUID(),
                      policy.policyId,
                      policy.noticeVersion,
                    ],
                  )
                ).rows[0].outcome,
              ).toBe("created");
            }
            before = await records(client);
          }
          await migrate(drizzle(client), {
            migrationsFolder: path.join(root, "drizzle"),
          });
          await client.query(runtimeGrantsSql);
          if (before)
            expect((await records(client, before.columns)).rows).toEqual(
              before.rows,
            );
          if (legacy) {
            expect(await legacy.access()).toEqual(legacy.before);
            await legacy.reviewActions();
          }
          expect(
            (
              await client.query(
                "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
              )
            ).rows[0].count,
          ).toBe(candidate.entries.length);
          expect((await verifyRuntimeGrants(client)).functionChecks).toBe(100);
          await verifyProtections(client, candidate, candidate.entries.length);
          expect(
            (
              await client.query(
                "SELECT count(*)::int AS count FROM public.local_workflow_claims",
              )
            ).rows[0].count,
          ).toBe(0);
          expect(
            (
              await client.query(
                "SELECT count(*)::int AS count FROM public.local_workflow_staff",
              )
            ).rows[0].count,
          ).toBe(legacy ? 1 : 0);
          expect(
            (
              await client.query(
                "SELECT count(*)::int AS count FROM public.learner_independent_attestations",
              )
            ).rows[0].count,
          ).toBe(0);
        } finally {
          client.release();
        }
      } finally {
        await pool?.end();
        if (created)
          await owner.pool.query(`DROP DATABASE ${database} WITH (FORCE)`);
        await owner.pool.end();
        await rm(directory, { recursive: true, force: true });
      }
    },
    30000,
  );
});
