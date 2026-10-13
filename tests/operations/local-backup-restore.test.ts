import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { Client } from "pg";
import {
  acceptedTableInventory,
  drill,
  readSource,
  snapshot,
} from "../../scripts/local-backup-restore";

import { openWorld, closeWorld, createAccount } from "../integration/support";
import {
  provisionAdmissionPolicy,
  assignAdmissionReviewer,
} from "../support/learner-admission-fixtures";
import {
  createAdmission,
  mutateAdmissionReview,
  readAssignedAdmission,
} from "../../src/features/learner-admission/service";
import {
  screeningFixture,
  responseFixture,
} from "../integration/screening-fixtures";
import {
  recordScreeningCheck,
  decideScreening,
} from "../../src/features/tutor-screening/service";
import {
  createSafeguardingCase,
  changeSafeguardingResponse,
  changeSafetyRestriction,
} from "../../src/features/safeguarding/service";
import {
  provisionResponseGrant,
  provisionSafetyRestriction,
} from "../../src/features/safeguarding/fixture-tooling";
import {
  grantWorkflowTask,
  workflowFixture,
} from "../support/booking-workflows-fixtures";
import {
  changePolicyBooking,
  createPolicyReservation,
  readWorkflowCandidates,
} from "../../src/features/booking-workflows/service";

import {
  provisionPublicationPolicy,
  completedPublicationBooking,
  grantPublication,
} from "../support/review-publication-fixtures";
import {
  submitPublication,
  decidePublication,
} from "../../src/features/review-publication/service";

import { bindTransactionalDelivery } from "../../src/features/transactional-delivery/context";
import { drainTransactionalDeliveries } from "../../src/features/transactional-delivery/drain";

// Exercise the accepted providers/services, never disable history/receipt guards.
async function readinessFixture() {
  const world = openWorld();
  try {
    const reviewer = await createAccount(
      world,
      ["admin"],
      "Fictional restore reviewer",
    );
    const escalation = await createAccount(
      world,
      ["admin"],
      "Fictional restore escalation owner",
    );
    const dispatcher = await createAccount(
      world,
      ["admin"],
      "Fictional restore dispatcher",
    );
    const requester = await createAccount(
      world,
      [],
      "Fictional restore admission requester",
    );
    const admission = await provisionAdmissionPolicy(world.owner.pool);
    if (admission.authority !== "synthetic_test")
      throw new Error("Synthetic policy required.");
    const context = { runtime: world.runtime, admission };
    const request = await createAdmission(context, requester.headers, {
      management: "guardian",
      displayName: "Fictional restore learner",
      level: "elementary",
      timezone: "Asia/Manila",
      requestId: randomUUID(),
      policyVersion: admission.version,
      policyDigest: admission.contentDigest,
    });
    await assignAdmissionReviewer(world.owner.pool, request.id, reviewer.id);
    let revision = (
      await readAssignedAdmission(context, reviewer.headers, request.id)
    ).revision;
    for (const checkCode of ["guardian_authority", "guardian_notice"]) {
      const result = await mutateAdmissionReview(
        context,
        reviewer.headers,
        request.id,
        "evidence",
        {
          requestId: randomUUID(),
          revision,
          checkCode,
          reference: `synthetic:${randomUUID()}`,
        },
      );
      revision = result.revision;
    }
    const authorized = await mutateAdmissionReview(
      context,
      reviewer.headers,
      request.id,
      "decision",
      {
        requestId: randomUUID(),
        revision,
        action: "authorize",
      },
    );
    expect(authorized.state).toBe("authorized");
    const screening = await screeningFixture(world, reviewer);
    for (const [revision, code] of [
      "synthetic_check_a",
      "synthetic_check_b",
    ].entries())
      await recordScreeningCheck(
        screening.context,
        reviewer.headers,
        screening.profile.id,
        {
          revision,
          code,
          requestKey: randomUUID(),
          outcome: "passed",
          reference: `screening:${randomUUID()}`,
          checkedAt: new Date(Date.now() - 60000).toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      );
    await decideScreening(
      screening.context,
      reviewer.headers,
      screening.profile.id,
      {
        revision: 2,
        action: "approve",
        requestKey: randomUUID(),
      },
    );
    const response = await responseFixture(world, reviewer, escalation);
    const caseId = (
      await createSafeguardingCase(response.context, requester.headers, {
        category: "safety",
        subject: "Fictional restoration concern",
        body: "Fictional restoration evidence only.",
        requestKey: randomUUID(),
      })
    ).id;
    await provisionResponseGrant(
      world.owner,
      caseId,
      dispatcher.id,
      "dispatcher",
      response.expiry,
    );
    await provisionResponseGrant(
      world.owner,
      caseId,
      reviewer.id,
      "reviewer_choice",
      response.expiry,
    );
    await changeSafeguardingResponse(
      response.context,
      dispatcher.headers,
      caseId,
      {
        revision: 0,
        action: "assign",
        targetId: reviewer.id,
        requestKey: randomUUID(),
      },
    );
    await changeSafeguardingResponse(
      response.context,
      reviewer.headers,
      caseId,
      {
        revision: 1,
        action: "acknowledge",
        requestKey: randomUUID(),
      },
    );
    await provisionSafetyRestriction(
      world.owner,
      dispatcher.id,
      requester.id,
      response.expiry,
    );
    await changeSafetyRestriction(
      response.context,
      dispatcher.headers,
      requester.id,
      {
        revision: 0,
        action: "restrict",
        reason: "synthetic_safety_restrict",
        requestKey: randomUUID(),
      },
    );
    const workflow = await workflowFixture(world, reviewer);
    const slot = (
      await readWorkflowCandidates(
        workflow.context,
        workflow.requester.headers,
        workflow.choice,
      )
    )[6];
    if (!slot) throw new Error("Synthetic restore booking slot required.");
    const reservation = await createPolicyReservation(
      workflow.context,
      workflow.requester.headers,
      {
        ...workflow.choice,
        startAtUtc: slot.startAtUtc,
        endAtUtc: slot.endAtUtc,
        idempotencyKey: randomUUID(),
      },
    );
    await grantWorkflowTask(world, reservation.logicalBookingId, reviewer);
    const confirmed = await changePolicyBooking(
      workflow.context,
      reviewer.headers,
      reservation.id,
      "confirm",
      {
        requestId: randomUUID(),
        expectedRevision: reservation.workflowRevision,
        reasonCode: "synthetic_prerequisite_review",
      },
    );
    expect(confirmed.state).toBe("confirmed");
    let sdkCalls = 0;
    const delivery = bindTransactionalDelivery(
      world.runtime.db,
      {
        enabled: true,
        environment: "test",
        appOrigin: "https://learli.example",
        identitySecret: "synthetic-restoration-message-binding-only",
        apiKey: "re_synthetic_restoration_sdk_key_only",
        sender: "sender@example.test",
        verifiedSender: {
          sender: "sender@example.test",
          environment: "test",
          appOrigin: "https://learli.example",
        },
        allowedRecipients: [workflow.requester.email, workflow.tutor.email],
      },
      {
        fetch: async (input, options) => {
          if (
            String(input) !== "https://api.resend.com/emails" ||
            options?.method !== "POST"
          )
            throw new Error("External restoration HTTP is forbidden.");
          sdkCalls++;
          return Response.json({ id: randomUUID() });
        },
      },
    );
    if (!delivery)
      throw new Error("Synthetic restore delivery binding required.");
    const delivered = await drainTransactionalDeliveries(delivery, {
      eventId: confirmed.eventId,
    });
    expect(delivered.providerAccepted).toBe(2);
    expect(sdkCalls).toBe(2);
    const prepared = await world.owner.pool.query<{ count: number }>(
      "SELECT count(*)::int count FROM transactional_deliveries WHERE event_id=$1 AND state='provider_accepted' AND payload IS NOT NULL AND first_attempt_at IS NOT NULL AND idempotency_key IS NOT NULL",
      [confirmed.eventId],
    );
    expect(prepared.rows[0].count).toBe(2);

    const publication = await provisionPublicationPolicy(world);
    const publicationContext = { runtime: world.runtime, publication };
    const completed = await completedPublicationBooking(
      world,
      workflow,
      reviewer,
    );
    const review = await submitPublication(
      publicationContext,
      workflow.requester.headers,
      completed.id,
      {
        requestId: randomUUID(),
        bookingRevision: completed.workflowRevision,
        completionEventId: completed.eventId,
        rating: 4,
        comment: "Fictional restored publication",
      },
    );
    await grantPublication(world, review.id, reviewer, publication.policyId);
    let publicationRevision = review.revision;
    for (const state of ["approved", "published"]) {
      const decision = await decidePublication(
        publicationContext,
        reviewer.headers,
        review.id,
        {
          requestId: randomUUID(),
          expectedRevision: publicationRevision,
          state,
          privacyChecked: true,
        },
      );
      publicationRevision = decision.revision;
      expect(decision.state).toBe(state);
    }
    return {
      admissionId: request.id,
      screeningTutor: screening.profile.id,
      caseId,
      policyBookingId: confirmed.id,
    };
  } finally {
    // Readiness history is intentionally retained in this owned source database.
    await closeWorld(world);
  }
}

const startupFault = vi.hoisted(() => ({
  mode: "" as "" | "log-write" | "nonzero" | "timeout",
  livePid: 0,
  directory: "",
}));
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  const fs = await import("node:fs");
  return {
    ...actual,
    spawnSync: (...args: Parameters<typeof actual.spawnSync>) => {
      const result = actual.spawnSync(...args);
      const toolArgs = args[1];
      if (
        startupFault.mode &&
        path.basename(String(args[0])) === "pg_ctl" &&
        Array.isArray(toolArgs) &&
        toolArgs.includes("start") &&
        result.status === 0
      ) {
        const data = toolArgs[toolArgs.indexOf("-D") + 1];
        startupFault.directory = path.dirname(data);
        startupFault.livePid = Number(
          fs
            .readFileSync(path.join(data, "postmaster.pid"), "utf8")
            .split("\n")[0],
        );
        // This proves a real server exists before the failure is injected.
        process.kill(startupFault.livePid, 0);
        if (startupFault.mode === "nonzero") return { ...result, status: 1 };
        if (startupFault.mode === "timeout")
          return {
            ...result,
            status: null,
            error: Object.assign(new Error("Synthetic pg_ctl timeout"), {
              code: "ETIMEDOUT",
            }),
          };
      }
      return result;
    },
  };
});
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeFileSync: (...args: Parameters<typeof actual.writeFileSync>) => {
      if (
        startupFault.mode === "log-write" &&
        startupFault.livePid &&
        path.dirname(String(args[0])) === startupFault.directory &&
        path.basename(String(args[0])).startsWith("pg_ctl-")
      )
        throw Object.assign(new Error("Synthetic evidence disk full"), {
          code: "ENOSPC",
        });
      return actual.writeFileSync(...args);
    },
  };
});

describe("owned synthetic backup and real restoration", () => {
  it("restores exact migrated records, ACLs, constraints and refuses reuse/occupied targets", async () => {
    const source = readSource(process.cwd());
    const owner = new Client(source.config);
    await owner.connect();
    const user = `restore-${randomUUID()}`,
      tutorUser = `restore-${randomUUID()}`;
    const tutor = randomUUID(),
      learner = randomUUID(),
      booking = randomUUID();
    const runId = `proof-${randomUUID()}`;
    const port = Number(process.env.LEARLI_RESTORE_PORT ?? 55512);
    try {
      const readiness = await readinessFixture();
      expect(readiness.admissionId).toBeTruthy();
      expect(readiness.policyBookingId).toBeTruthy();
      await owner.query(
        "INSERT INTO \"user\" (id,name,email,email_verified,created_at,updated_at) VALUES ($1,'Synthetic restore learner',$2,true,now(),now()),($3,'Synthetic restore tutor',$4,true,now(),now())",
        [user, `${user}@learli.test`, tutorUser, `${tutorUser}@learli.test`],
      );
      await owner.query(
        "INSERT INTO user_roles (user_id,role) VALUES ($1,'student'),($2,'tutor')",
        [user, tutorUser],
      );
      await owner.query(
        "INSERT INTO tutor_profiles (id,user_id,headline,bio,teaching_background,timezone,slug,review_status) VALUES ($1,$2,'Synthetic restore tutor','Synthetic restoration fixture','Synthetic background','UTC',$3,'approved')",
        [tutor, tutorUser, `restore-${tutor}`],
      );
      await owner.query(
        "INSERT INTO learner_profiles (id,fixture_key,source,management,user_id,display_name,level,timezone) VALUES ($1,$2,'local_fixture','self',$3,'Synthetic restore learner','college_support','UTC')",
        [learner, `restore-${learner}`, user],
      );
      const subject = (
        await owner.query<{ id: string }>(
          "SELECT id FROM subjects WHERE slug='math'",
        )
      ).rows[0].id;
      await owner.query(
        "INSERT INTO tutor_subjects (tutor_id,subject_id,levels) VALUES ($1,$2,ARRAY['college_support'])",
        [tutor, subject],
      );
      await owner.query(
        "INSERT INTO bookings (id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,expires_at) VALUES ($1,'local_simulation',$2,$3,$4,$5,now()+interval '2 days',now()+interval '2 days 1 hour','UTC',$6,repeat('a',64),'demo_reserved',now()+interval '1 hour')",
        [booking, tutor, learner, user, subject, randomUUID()],
      );
      await owner.query(
        "INSERT INTO booking_events (id,booking_id,event) VALUES ($1,$2,'demo_reserved')",
        [randomUUID(), booking],
      );
      const before = await snapshot(owner);
      // Constrained unsafe provenance is denied on actual PG without dropping rules.
      for (const sourceValue of ["operational", "real_person", "unknown"]) {
        await owner.query("BEGIN");
        try {
          await expect(
            owner.query(
              "INSERT INTO learner_profiles (id,fixture_key,source,management,user_id,display_name,level,timezone) VALUES ($1,$2,$3,'self',$4,'Fictional unsafe fixture','college_support','UTC')",
              [
                randomUUID(),
                `restore-unsafe-${randomUUID()}`,
                sourceValue,
                user,
              ],
            ),
          ).rejects.toMatchObject({ code: "23514" });
        } finally {
          await owner.query("ROLLBACK");
        }
      }
      expect(await snapshot(owner)).toEqual(before);
      // Change only this fictional fixture's address, then put the exact row back.
      for (const address of [
        "fictional@example.com",
        "missing-at.test",
        "fictional@learli.test.evil.example",
      ]) {
        await owner.query('UPDATE "user" SET email=$2 WHERE id=$1', [
          user,
          address,
        ]);
        const unsafeId = `unsafe-${randomUUID()}`;
        const unsafeState = await snapshot(owner);
        try {
          await expect(
            drill({ runId: unsafeId, restorePort: port }),
          ).rejects.toThrow("failed");
          expect(
            existsSync(path.join(source.local, "backup-restore", unsafeId)),
          ).toBe(false);
          expect(await snapshot(owner)).toEqual(unsafeState);
        } finally {
          await owner.query('UPDATE "user" SET email=$2 WHERE id=$1', [
            user,
            `${user}@learli.test`,
          ]);
        }
      }
      expect(await snapshot(owner)).toEqual(before);
      const foreignId = `foreign-${randomUUID()}`;
      const foreignDirectory = path.join(
        source.local,
        "backup-restore",
        foreignId,
      );
      mkdirSync(foreignDirectory, { recursive: true, mode: 0o700 });
      const sentinel = path.join(foreignDirectory, "unrecognized.txt");
      writeFileSync(sentinel, "Foreign target must stay intact", {
        mode: 0o600,
      });
      await expect(
        drill({ runId: foreignId, restorePort: port }),
      ).rejects.toThrow("existing-target");
      expect(readFileSync(sentinel, "utf8")).toBe(
        "Foreign target must stay intact",
      );
      expect(existsSync(path.join(foreignDirectory, "backup.dump"))).toBe(
        false,
      );
      const failedId = `failure-${randomUUID()}`;
      const savedTools = process.env.PG_BIN;
      process.env.PG_BIN = path.join(source.local, "missing-drill-tools");
      try {
        await expect(
          drill({ runId: failedId, restorePort: port }),
        ).rejects.toThrow("failed");
      } finally {
        if (savedTools === undefined) delete process.env.PG_BIN;
        else process.env.PG_BIN = savedTools;
      }
      const failedDirectory = path.join(
        source.local,
        "backup-restore",
        failedId,
      );
      expect(
        JSON.parse(
          readFileSync(path.join(failedDirectory, "failure.json"), "utf8"),
        ).status,
      ).toBe("FAIL");
      expect(existsSync(path.join(failedDirectory, "result.json"))).toBe(false);
      expect(existsSync(path.join(failedDirectory, "data"))).toBe(false);
      for (const mode of ["log-write", "nonzero", "timeout"] as const) {
        const faultId = `startup-${mode}-${randomUUID()}`;
        startupFault.mode = mode;
        startupFault.livePid = 0;
        startupFault.directory = "";
        try {
          await expect(
            drill({ runId: faultId, restorePort: port }),
          ).rejects.toThrow("failed");
          expect(startupFault.livePid).toBeGreaterThan(0);
          expect(() => process.kill(startupFault.livePid, 0)).toThrow();
          const faultDirectory = path.join(
            source.local,
            "backup-restore",
            faultId,
          );
          expect(
            existsSync(path.join(faultDirectory, "data/postmaster.pid")),
          ).toBe(false);
          expect(existsSync(path.join(faultDirectory, "backup.dump"))).toBe(
            true,
          );
          expect(existsSync(path.join(faultDirectory, "server.log"))).toBe(
            true,
          );
          expect(existsSync(path.join(faultDirectory, "result.json"))).toBe(
            false,
          );
          expect(
            JSON.parse(
              readFileSync(path.join(faultDirectory, "failure.json"), "utf8"),
            ).status,
          ).toBe("FAIL");
          // Binding the port proves actual cleanup, beyond internal bookkeeping.
          const available = net.createServer();
          await new Promise<void>((resolve, reject) => {
            available.once("error", reject);
            available.listen(port, "127.0.0.1", resolve);
          });
          await new Promise<void>((resolve, reject) =>
            available.close((error) => (error ? reject(error) : resolve())),
          );
          expect(
            (await owner.query("SELECT 1 FROM bookings WHERE id=$1", [booking]))
              .rowCount,
          ).toBe(1);
          expect(await snapshot(owner)).toEqual(before);
          expect(readFileSync(sentinel, "utf8")).toBe(
            "Foreign target must stay intact",
          );
        } finally {
          startupFault.mode = "";
        }
      }
      const result = await drill({ runId, restorePort: port });
      expect(result.status).toBe("PASS");
      expect(result.tables).toBe(acceptedTableInventory(process.cwd()).length);
      expect(result.migrations).toBe(
        JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")).entries
          .length,
      );
      const evidenceRoot = path.join(source.local, "backup-restore", runId);
      const original = JSON.parse(
        readFileSync(path.join(evidenceRoot, "source-evidence.json"), "utf8"),
      );
      const restored = JSON.parse(
        readFileSync(path.join(evidenceRoot, "target-evidence.json"), "utf8"),
      );
      expect(
        restored.rows.map((row: { table: string }) => row.table).sort(),
      ).toEqual(acceptedTableInventory(process.cwd()));
      for (const table of [
        "learner_admission_policies",
        "learner_admission_policy_state",
        "learner_admissions",
        "learner_admission_reviewers",
        "learner_admission_assignments",
        "learner_admission_evidence",
        "learner_admission_events",
        "guardian_learner_links",
        "tutor_screening_policies",
        "tutor_screening_policy_heads",
        "tutor_screening_cases",
        "tutor_screening_staff",
        "tutor_screening_assignments",
        "tutor_screening_checks",
        "tutor_screening_decisions",
        "tutor_screening_decision_checks",
        "tutor_screening_events",
        "support_response_policies",
        "support_response_policy_heads",
        "support_cases",
        "support_case_responses",
        "support_response_events",
        "support_reviewers",
        "support_dispatch_grants",
        "support_reviewer_choices",
        "support_case_assignments",
        "support_case_events",
        "account_restriction_targets",
        "account_restriction_grants",
        "account_restriction_events",
        "booking_workflow_policies",
        "booking_workflow_policy_head",
        "booking_workflow_grants",
        "booking_workflow_notice_intents",
        "review_publication_policies",
        "review_publication_policy_head",
        "publication_reviews",
        "publication_review_events",
        "publication_moderator_grants",
        "transactional_deliveries",
      ]) {
        const prior = original.rows.find(
          (row: { table: string }) => row.table === `public.${table}`,
        );
        expect(prior, table).toBeDefined();
        expect(prior.count, table).toBeGreaterThan(0);
        expect(
          restored.rows.find(
            (row: { table: string }) => row.table === `public.${table}`,
          ),
          table,
        ).toEqual(prior);
      }
      expect(result.proof.preparedDeliveryImmutable).toBe(true);
      expect(result.proof.immutableReadinessTables).toEqual([
        "learner_admission_events",
        "learner_admission_policies",
        "learner_admission_evidence",
        "tutor_screening_checks",
        "tutor_screening_decisions",
        "tutor_screening_decision_checks",
        "tutor_screening_events",
        "support_response_policies",
        "support_response_events",
        "booking_workflow_policies",
        "booking_workflow_notice_intents",
        "review_publication_policies",
        "publication_review_events",
        "transactional_deliveries",
      ]);
      expect(await snapshot(owner)).toEqual(before);
      expect(result.exactRowsSchemaGrantsSequencesRoles).toBe(true);
      expect(result.sourcePreserved).toBe(true);
      expect(result.proof.overlapConstraint).toBe(true);
      expect(result.proof.runtimeDenials).toBe(5);
      expect(result.proof.schemaRuleDriftRejected).toBe(true);
      const record = JSON.parse(
        readFileSync(
          path.join(source.local, "backup-restore", runId, "result.json"),
          "utf8",
        ),
      );
      expect(record.status).toBe("PASS");
      await expect(drill({ runId, restorePort: port })).rejects.toThrow(
        "existing-target",
      );
      const listener = net.createServer();
      await new Promise<void>((resolve, reject) => {
        listener.once("error", reject);
        listener.listen(port, "127.0.0.1", resolve);
      });
      try {
        await expect(
          drill({ runId: `occupied-${randomUUID()}`, restorePort: port }),
        ).rejects.toThrow("occupied-port");
      } finally {
        await new Promise<void>((resolve, reject) =>
          listener.close((error) => (error ? reject(error) : resolve())),
        );
      }
      // The source still contains its exact fixture; only the new target was stopped.
      expect(
        (await owner.query("SELECT 1 FROM bookings WHERE id=$1", [booking]))
          .rowCount,
      ).toBe(1);
    } finally {
      // Cleanup owns only these exact fixture identifiers; preserved dump remains private.
      await owner.query(
        "DELETE FROM booking_notification_deliveries WHERE event_id IN (SELECT id FROM booking_events WHERE booking_id=$1)",
        [booking],
      );
      await owner.query("DELETE FROM booking_events WHERE booking_id=$1", [
        booking,
      ]);
      await owner.query("DELETE FROM bookings WHERE id=$1", [booking]);
      await owner.query("DELETE FROM learner_profiles WHERE id=$1", [learner]);
      await owner.query("DELETE FROM tutor_profiles WHERE id=$1", [tutor]);
      await owner.query("DELETE FROM user_roles WHERE user_id IN ($1,$2)", [
        user,
        tutorUser,
      ]);
      await owner.query('DELETE FROM "user" WHERE id IN ($1,$2)', [
        user,
        tutorUser,
      ]);
      await owner.end();
    }
  }, 180_000);
});
