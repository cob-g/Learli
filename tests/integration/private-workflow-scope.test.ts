import { randomInt, randomUUID } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
import {
  parsePrivateWorkflow,
  PrivateWorkflowError,
  type PrivateWorkflowBinding,
  type PrivateWorkflowPacket,
} from "@/features/private-workflow/config";
import { getPrivateWorkflow } from "@/features/private-workflow/runtime";
import { localDatabaseConfig } from "@/lib/db/local-config";
import {
  findEligibleTutor,
  listEligibleTutors,
} from "@/features/tutors/eligibility";
import { readPublicCandidates } from "@/features/public-availability/service";
import {
  changePolicyBooking,
  createPolicyReservation,
  loadWorkflowOptions,
  readWorkflowCandidates,
} from "@/features/booking-workflows/service";
import {
  listParticipantBookingOverview,
  listParticipantBookings,
  readParticipantBooking,
} from "@/features/bookings/read-service";
import {
  readPrivateMeetingLink,
  savePrivateMeetingLink,
} from "@/features/booking-meeting-links/service";
import { createMyLearner } from "@/features/learners/service";
import {
  readOwnTutorProfile,
  saveOwnTutorProfile,
} from "@/features/tutors/service";
import { saveOwnAvailability } from "@/features/availability/service";
import {
  decideScreening,
  recordScreeningCheck,
  requestScreening,
} from "@/features/tutor-screening/service";
import { provisionScreeningAssignment } from "@/features/tutor-screening/fixture-tooling";
import {
  grantWorkflowTask,
  workflowFixture,
} from "../support/booking-workflows-fixtures";
import { observedLock } from "./screening-fixtures";
import {
  closeWorld,
  createAccount,
  openWorld,
  type TestAccount,
  type World,
} from "./support";

let world: World,
  reviewer: TestAccount,
  fixture: Awaited<ReturnType<typeof workflowFixture>>,
  outsider: TestAccount,
  outsiderProfile: NonNullable<Awaited<ReturnType<typeof readOwnTutorProfile>>>,
  binding: PrivateWorkflowBinding,
  activePacket: PrivateWorkflowPacket,
  directory: string,
  file: string,
  localLearnerId: string,
  localBookingId: string;

/** A second real screened Tutor under the same current receipt isolates audience
 * filtering from stale policy filtering. Only assignment metadata is provisioned. */
async function secondCurrentTutor() {
  const tutor = await createAccount(world, ["tutor"]),
    subject = (
      await world.owner.pool.query("SELECT id FROM subjects WHERE slug='math'")
    ).rows[0].id;
  await saveOwnTutorProfile(world.runtime, tutor.headers, {
    headline: "Fictional finite audience tutor",
    bio: "Fictional private workflow acceptance introduction.",
    teachingBackground: "Fictional private workflow acceptance background.",
    timezone: "Asia/Manila",
    offerings: [
      { subjectId: subject, levels: ["high_school", "college_support"] },
    ],
  });
  const profile = await readOwnTutorProfile(world.runtime, tutor.headers);
  if (!profile) throw new Error("Required actual Tutor profile unavailable.");
  const context = { runtime: world.runtime, screening: fixture.policy };
  await requestScreening(context, tutor.headers, profile.id, {
    requestKey: randomUUID(),
  });
  await provisionScreeningAssignment(
    world.owner,
    profile.id,
    reviewer.id,
    "synthetic_readiness",
    new Date(fixture.policy.validUntil),
  );
  for (const [revision, code] of fixture.policy.requiredCheckCodes.entries())
    await recordScreeningCheck(context, reviewer.headers, profile.id, {
      revision,
      code,
      requestKey: randomUUID(),
      outcome: "passed",
      reference: `screening:${randomUUID()}`,
      checkedAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
  await decideScreening(context, reviewer.headers, profile.id, {
    revision: fixture.policy.requiredCheckCodes.length,
    action: "approve",
    requestKey: randomUUID(),
  });
  await saveOwnAvailability(world.runtime, tutor.headers, {
    version: 0,
    timezone: "Asia/Manila",
    windows: Array.from({ length: 7 }, (_, i) => ({
      isoWeekday: i + 1,
      startMinute: 0,
      endMinute: 1440,
    })),
  });
  return { tutor, profile };
}

function selectPacket(value: PrivateWorkflowPacket = activePacket) {
  const validated = parsePrivateWorkflow(value, binding),
    next = `${file}.next`;
  writeFileSync(next, JSON.stringify(validated), { mode: 0o600, flag: "wx" });
  renameSync(next, file);
  vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", file);
  return validated;
}

beforeAll(async () => {
  vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
  world = openWorld();
  reviewer = await createAccount(world, ["admin"]);
  fixture = await workflowFixture(world, reviewer, "guardian", "tutor");
  ({ tutor: outsider, profile: outsiderProfile } = await secondCurrentTutor());
  const database = localDatabaseConfig(process.env.DATABASE_URL, true);
  binding = {
    origin: world.runtime.origin,
    database: {
      mode: "local-test",
      host: database.host as "127.0.0.1" | "localhost" | "::1",
      port: database.port,
      database: "learli_test",
      runtimeRole: "learli_app",
    },
  };
  activePacket = parsePrivateWorkflow(
    {
      version: 1,
      purpose: "private_fictional_workflow",
      audience: "fictional_only",
      realIntake: "disabled",
      payments: "disabled",
      origin: binding.origin,
      database: binding.database,
      accountEmails: [reviewer, fixture.requester, fixture.tutor].map(
        (a) => a.email,
      ),
      admission: fixture.admission,
      screening: fixture.policy,
      booking: fixture.booking,
    },
    binding,
  );

  // Genuine local creation preserves the old learner/link contract. The explicit
  // legacy reservation is a read fixture, never a confirmation or attendance claim.
  const learner = await createMyLearner(
    world.runtime,
    fixture.requester.headers,
    {
      requestId: randomUUID(),
      management: "guardian",
      displayName: "Fictional legacy learner",
      level: "high_school",
      timezone: "Asia/Manila",
    },
  );
  localLearnerId = learner.id;
  localBookingId = randomUUID();
  await world.owner.pool.query(
    `INSERT INTO bookings(id,source,tutor_id,learner_id,booked_by_user_id,subject_id,start_at_utc,end_at_utc,display_timezone,idempotency_key,request_fingerprint,state,expires_at)
     VALUES($1,'local_simulation',$2,$3,$4,(SELECT id FROM subjects WHERE slug='math'),clock_timestamp()+interval '30 days',clock_timestamp()+interval '30 days 1 hour','UTC',$5,$6,'demo_reserved',clock_timestamp()+interval '10 minutes')`,
    [
      localBookingId,
      fixture.profile.id,
      localLearnerId,
      fixture.requester.id,
      randomUUID(),
      "a".repeat(64),
    ],
  );
  mkdirSync(path.join(process.cwd(), ".local"), {
    recursive: true,
    mode: 0o700,
  });
  directory = mkdtempSync(
    path.join(process.cwd(), ".local/private-workflow-scope-"),
  );
  file = path.join(directory, "packet.json");
  selectPacket();
}, 60000);
beforeEach(() => {
  selectPacket();
});
afterAll(async () => {
  vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
  if (world) {
    await world.owner.pool.query(
      "UPDATE booking_workflow_policy_head SET enabled=false WHERE source='synthetic_readiness'",
    );
    await world.owner.pool.query(
      "UPDATE tutor_screening_policy_heads SET status='revoked' WHERE provenance='synthetic_readiness'",
    );
  }
  await closeWorld(world);
  if (directory) rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const publicChoice = (slugs = [fixture.profile.slug]) => ({
  tutorSlugs: slugs,
  subjectSlug: "math",
  level: "high_school",
  displayTimezone: "Asia/Manila",
});
async function reservationInput() {
  const slot = (
    await readWorkflowCandidates(
      fixture.context,
      fixture.requester.headers,
      fixture.choice,
    )
  )[6];
  if (!slot) throw new Error("Required actual candidate unavailable.");
  return {
    ...fixture.choice,
    startAtUtc: slot.startAtUtc,
    endAtUtc: slot.endAtUtc,
    idempotencyKey: randomUUID(),
  };
}
async function reserve() {
  return createPolicyReservation(
    fixture.context,
    fixture.requester.headers,
    await reservationInput(),
  );
}
async function assertRequestRolledBack(key: string, soft = false) {
  const rows = await world.owner.pool.query(
    `SELECT
      (SELECT count(*)::int FROM bookings WHERE booked_by_user_id=$1 AND idempotency_key=$2) AS bookings,
      (SELECT count(*)::int FROM booking_lifecycle_events WHERE actor_user_id=$1 AND request_id=$2) AS events`,
    [fixture.requester.id, key],
  );
  (soft ? expect.soft : expect)(rows.rows[0]).toEqual({
    bookings: 0,
    events: 0,
  });
}

/** Keep assertion failures free of meeting URLs, private DTOs and candidate arrays. */
function outcome(operation: Promise<unknown>) {
  return operation.then(
    () => ({ resolved: true, status: null, configurationChanged: false }),
    (error: unknown) => ({
      resolved: false,
      status:
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof error.status === "number"
          ? error.status
          : null,
      configurationChanged: error instanceof PrivateWorkflowError,
    }),
  );
}
const unavailable = {
  resolved: false,
  status: 404,
  configurationChanged: false,
};

describe("private workflow finite audience and exact screening receipt on PostgreSQL", () => {
  it("keeps the optional legacy scope and the allowed Tutor usable through the actual private packet", async () => {
    expect(getPrivateWorkflow(world.runtime)).toEqual(activePacket);
    const baseline = await listEligibleTutors(
      world.runtime.db,
      {},
      "synthetic_readiness",
    );
    expect(baseline.map((t) => t.slug)).toEqual(
      expect.arrayContaining([fixture.profile.slug, outsiderProfile.slug]),
    );
    const scoped = await listEligibleTutors(
      world.runtime.db,
      {},
      "synthetic_readiness",
      getPrivateWorkflow(world.runtime),
    );
    expect(scoped.map((t) => t.slug)).toEqual([fixture.profile.slug]);
    const options = await loadWorkflowOptions(
      fixture.context,
      fixture.requester.headers,
    );
    expect(options.tutors.map((t) => t.slug)).toEqual([fixture.profile.slug]);
    expect(options.learners.map((l) => l.id)).toEqual([fixture.learner.id]);
    const saved = await reserve();
    expect(saved.state).toBe("provisional");
    for (const [actor, scope] of [
      [fixture.requester, "guardian"],
      [fixture.tutor, "tutor"],
    ] as const)
      expect(
        (
          await readParticipantBooking(
            world.runtime,
            actor.headers,
            saved.id,
            scope,
          )
        ).id,
      ).toBe(saved.id);
  });

  it("hides a genuinely current screened out-of-list Tutor from directory/candidates and rejects manually submitted bookings", async () => {
    expect(getPrivateWorkflow(world.runtime)?.accountEmails).not.toContain(
      outsider.email,
    );
    expect(
      await findEligibleTutor(
        world.runtime.db,
        outsiderProfile.slug,
        "synthetic_readiness",
      ),
    ).not.toBeNull();
    expect(
      await findEligibleTutor(
        world.runtime.db,
        outsiderProfile.slug,
        "synthetic_readiness",
        getPrivateWorkflow(world.runtime),
      ),
    ).toBeNull();
    const publicTimes = await readPublicCandidates(
      world.runtime,
      publicChoice([fixture.profile.slug, outsiderProfile.slug]),
    );
    expect(
      publicTimes.tutors.find((t) => t.tutorSlug === fixture.profile.slug)
        ?.state,
    ).toBe("available");
    expect(
      publicTimes.tutors.find((t) => t.tutorSlug === outsiderProfile.slug),
    ).toEqual({
      tutorSlug: outsiderProfile.slug,
      state: "unavailable",
      times: [],
    });
    const value = {
      ...(await reservationInput()),
      tutorSlug: outsiderProfile.slug,
    };
    await expect(
      readWorkflowCandidates(
        fixture.context,
        fixture.requester.headers,
        valueWithoutTimes(value),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      createPolicyReservation(
        fixture.context,
        fixture.requester.headers,
        value,
      ),
    ).rejects.toMatchObject({ status: 404 });
    await assertRequestRolledBack(value.idempotencyKey);
  });

  it("denies changed screening receipts including altered same-version terms while the globally current Tutor remains approved", async () => {
    const saved = await reserve();
    for (const screening of [
      {
        ...activePacket.screening,
        version: `${activePacket.screening.version}-other`,
      },
      { ...activePacket.screening, reference: `policy:${randomUUID()}` },
      { ...activePacket.screening, requiredCheckCodes: ["altered_receipt"] },
    ]) {
      selectPacket();
      const value = await reservationInput();
      selectPacket(
        parsePrivateWorkflow({ ...activePacket, screening }, binding),
      );
      expect(
        await findEligibleTutor(
          world.runtime.db,
          fixture.profile.slug,
          "synthetic_readiness",
        ),
      ).not.toBeNull();
      expect
        .soft(
          (
            await listEligibleTutors(
              world.runtime.db,
              {},
              "synthetic_readiness",
              getPrivateWorkflow(world.runtime),
            )
          ).length,
        )
        .toBe(0);
      expect
        .soft(
          (
            await readPublicCandidates(world.runtime, publicChoice())
          ).tutors.map((tutor) => ({
            state: tutor.state,
            times: tutor.times.length,
          })),
        )
        .toEqual([{ state: "unavailable", times: 0 }]);
      await expect
        .soft(
          await outcome(
            readWorkflowCandidates(
              fixture.context,
              fixture.requester.headers,
              valueWithoutTimes(value),
            ),
          ),
        )
        .toEqual(unavailable);
      await expect
        .soft(
          await outcome(
            readParticipantBooking(
              world.runtime,
              fixture.requester.headers,
              saved.id,
              "guardian",
            ),
          ),
        )
        .toEqual(unavailable);
      await expect
        .soft(
          await outcome(
            readPrivateMeetingLink(
              world.runtime,
              fixture.requester.headers,
              saved.id,
            ),
          ),
        )
        .toEqual(unavailable);
      await expect
        .soft(
          await outcome(
            createPolicyReservation(
              fixture.context,
              fixture.requester.headers,
              value,
            ),
          ),
        )
        .toEqual(unavailable);
      await assertRequestRolledBack(value.idempotencyKey, true);
    }
  });

  it("hides legacy records, rejects a waited meeting save after packet removal and rechecks booking/link access for either removed participant", async () => {
    vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
    const baseline = await listParticipantBookings(
      world.runtime,
      fixture.requester.headers,
      { scope: "guardian" },
    );
    expect(baseline.learners.map((l) => l.id)).toContain(localLearnerId);
    expect(baseline.items.map((b) => b.id)).toContain(localBookingId);
    selectPacket();
    const requested = await reserve();
    await grantWorkflowTask(world, requested.logicalBookingId, reviewer, [
      "confirm",
    ]);
    const confirmed = await changePolicyBooking(
      fixture.context,
      reviewer.headers,
      requested.id,
      "confirm",
      {
        requestId: randomUUID(),
        expectedRevision: 0,
        reasonCode: "synthetic_prerequisite_review",
      },
    );
    const url = "https://meet.google.com/abc-defg-hij";
    await savePrivateMeetingLink(
      world.runtime,
      fixture.tutor.headers,
      confirmed.id,
      { requestId: randomUUID(), expectedRevision: 0, url },
    );
    const currentMeeting = await readPrivateMeetingLink(
      world.runtime,
      fixture.requester.headers,
      confirmed.id,
    );
    expect({
      state: currentMeeting.state,
      urlMatches:
        currentMeeting.state === "present" && currentMeeting.url === url,
    }).toEqual({ state: "present", urlMatches: true });
    const meetingSnapshot = async () =>
      (
        await world.owner.pool.query(
          `SELECT
          (SELECT count(*)::int FROM booking_meeting_links WHERE booking_id=$1) AS links,
          (SELECT count(*)::int FROM booking_meeting_link_events WHERE booking_id=$1) AS events,
          (SELECT revision FROM booking_meeting_links WHERE booking_id=$1) AS revision,
          (SELECT url=$2 FROM booking_meeting_links WHERE booking_id=$1) AS url_unchanged`,
          [confirmed.id, url],
        )
      ).rows[0];
    const beforeSave = await meetingSnapshot(),
      blocker = await world.owner.pool.connect();
    let pendingSave: ReturnType<typeof outcome> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query(
        "SELECT id FROM tutor_profiles WHERE id=$1 FOR UPDATE",
        [fixture.profile.id],
      );
      pendingSave = outcome(
        savePrivateMeetingLink(
          world.runtime,
          fixture.tutor.headers,
          confirmed.id,
          {
            requestId: randomUUID(),
            expectedRevision: 1,
            url: "https://meet.google.com/jkl-mnop-qrs",
          },
        ),
      );
      await observedLock(world, "tutor_profiles");
      selectPacket(
        parsePrivateWorkflow(
          {
            ...activePacket,
            accountEmails: activePacket.accountEmails.filter(
              (email) => email !== fixture.tutor.email,
            ),
          },
          binding,
        ),
      );
      await blocker.query("COMMIT");
      expect(await pendingSave).toEqual({
        resolved: false,
        status: null,
        configurationChanged: true,
      });
    } finally {
      try {
        await blocker.query("ROLLBACK");
      } finally {
        blocker.release(true);
      }
      if (pendingSave) await pendingSave;
      selectPacket();
    }
    expect(await meetingSnapshot()).toEqual(beforeSave);
    const page = await listParticipantBookings(
        world.runtime,
        fixture.requester.headers,
        { scope: "guardian" },
      ),
      overview = await listParticipantBookingOverview(
        world.runtime,
        fixture.requester.headers,
        { scope: "guardian" },
      );
    for (const list of [page, overview.active, overview.history]) {
      expect(list.learners.map((l) => l.id)).toEqual([fixture.learner.id]);
      expect(list.items.map((b) => b.id)).not.toContain(localBookingId);
    }
    await expect(
      readParticipantBooking(
        world.runtime,
        fixture.requester.headers,
        localBookingId,
        "guardian",
      ),
    ).rejects.toMatchObject({ status: 404 });
    for (const [removed, reader, scope] of [
      [fixture.tutor, fixture.requester, "guardian"],
      [fixture.requester, fixture.tutor, "tutor"],
    ] as const) {
      selectPacket(
        parsePrivateWorkflow(
          {
            ...activePacket,
            accountEmails: activePacket.accountEmails.filter(
              (email) => email !== removed.email,
            ),
          },
          binding,
        ),
      );
      await expect(
        readParticipantBooking(
          world.runtime,
          reader.headers,
          confirmed.id,
          scope,
        ),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        readPrivateMeetingLink(world.runtime, reader.headers, confirmed.id),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        (
          await listParticipantBookings(world.runtime, reader.headers, {
            scope,
          })
        ).items,
      ).toEqual([]);
    }
  });

  it("rolls back the actual insert and history when packet scope changes before the post-write receipt", async () => {
    const value = await reservationInput(),
      suffix = randomUUID().replaceAll("-", ""),
      functionName = `private_scope_pause_${suffix}`,
      triggerName = `private_scope_insert_${suffix}`,
      lockKey = randomInt(1, 2 ** 31),
      blocker = await world.owner.pool.connect();
    let functionCreated = false,
      triggerCreated = false,
      settled: Promise<{ status: unknown }> | undefined;
    try {
      // Only this random request pauses after its real INSERT. No policy, grants,
      // provider verification or domain result is replaced by this test barrier.
      await world.owner.pool
        .query(`CREATE FUNCTION public.${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.idempotency_key='${value.idempotencyKey}'::uuid THEN
          PERFORM pg_advisory_xact_lock(${lockKey}::bigint);
        END IF; RETURN NEW; END; $$`);
      functionCreated = true;
      await world.owner.pool.query(
        `CREATE TRIGGER ${triggerName} AFTER INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.${functionName}()`,
      );
      triggerCreated = true;
      await blocker.query("SELECT pg_advisory_lock($1::bigint)", [lockKey]);
      settled = createPolicyReservation(
        fixture.context,
        fixture.requester.headers,
        value,
      ).then(
        () => ({ status: 200 }),
        (error: unknown) => ({
          status:
            typeof error === "object" && error !== null && "status" in error
              ? error.status
              : 500,
        }),
      );
      await observedLock(world, "create_policy_booking");
      selectPacket(
        parsePrivateWorkflow(
          {
            ...activePacket,
            accountEmails: activePacket.accountEmails.filter(
              (email) => email !== fixture.tutor.email,
            ),
          },
          binding,
        ),
      );
      await blocker.query("SELECT pg_advisory_unlock($1::bigint)", [lockKey]);
      expect(await settled).toEqual({ status: 404 });
      await assertRequestRolledBack(value.idempotencyKey);
    } finally {
      const cleanupErrors: unknown[] = [];
      try {
        await blocker.query("SELECT pg_advisory_unlock($1::bigint)", [lockKey]);
      } catch (error) {
        cleanupErrors.push(error);
      } finally {
        // Destroy this dedicated connection even if unlock fails, releasing its locks.
        blocker.release(true);
      }
      if (settled) await settled;
      try {
        if (triggerCreated)
          await world.owner.pool.query(
            `DROP TRIGGER ${triggerName} ON public.bookings`,
          );
      } catch (error) {
        cleanupErrors.push(error);
      }
      try {
        if (functionCreated)
          await world.owner.pool.query(
            `DROP FUNCTION public.${functionName}()`,
          );
      } catch (error) {
        cleanupErrors.push(error);
      }
      if (cleanupErrors.length)
        throw new Error("Scoped test barrier cleanup failed. Details omitted.");
    }
  });
});

function valueWithoutTimes(
  value: Awaited<ReturnType<typeof reservationInput>>,
) {
  return {
    learnerId: value.learnerId,
    tutorSlug: value.tutorSlug,
    subjectSlug: value.subjectSlug,
    displayTimezone: value.displayTimezone,
  };
}
