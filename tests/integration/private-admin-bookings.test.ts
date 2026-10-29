import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  listStaffBookings,
  readPrivateStaffBooking,
} from "@/features/booking-workflows/staff-read";
import { handleStaffBookingList } from "@/features/booking-workflows/staff-handler";
import {
  changePolicyBooking,
  createPolicyReservation,
  readWorkflowCandidates,
  readWorkflowTask,
} from "@/features/booking-workflows/service";
import { savePrivateMeetingLink } from "@/features/booking-meeting-links/service";
import { privateAdminFixture } from "../support/private-admin-fixtures";
import {
  admittedFixture,
  grantWorkflowTask,
  historicalWorkflowBooking,
} from "../support/booking-workflows-fixtures";
import { jsonRequest, type TestAccount } from "./support";
import { password } from "./support";
import { enrollTestAdmin } from "../support/admin-mfa";
import {
  readAssignedAdmission,
  mutateAdmissionReview,
} from "@/features/learner-admission/service";

let f: Awaited<ReturnType<typeof privateAdminFixture>>;
let ownSelf: Awaited<ReturnType<typeof admittedFixture>>;
let foreign: Awaited<ReturnType<typeof admittedFixture>>;
let requesterStaff: TestAccount, tutorStaff: TestAccount;
type Receipt = Awaited<ReturnType<typeof createPolicyReservation>>;
let replaced: Receipt,
  current: Receipt,
  cancelled: Receipt,
  expired: Receipt,
  ungranted: Receipt,
  foreignBooking: Receipt;
const meeting = "https://meet.google.com/abc-defg-hij";

async function reserve(actor: TestAccount, learnerId: string) {
  const choice = { ...f.fixture.choice, learnerId };
  const slot = (
    await readWorkflowCandidates(f.fixture.context, actor.headers, choice)
  )[12];
  if (!slot) throw new Error("Required owned fixture slot unavailable.");
  return createPolicyReservation(f.fixture.context, actor.headers, {
    ...choice,
    startAtUtc: slot.startAtUtc,
    endAtUtc: slot.endAtUtc,
    idempotencyKey: randomUUID(),
  });
}
beforeAll(async () => {
  f = await privateAdminFixture();
  ownSelf = await admittedFixture(f.world, f.reviewer, "self");
  foreign = await admittedFixture(f.world, f.reviewer, "self");
  replaced = await reserve(f.fixture.requester, f.fixture.learner.id);
  await grantWorkflowTask(f.world, replaced.logicalBookingId, f.reviewer, [
    "confirm",
  ]);
  const move = (
    await readWorkflowCandidates(
      f.fixture.context,
      f.fixture.requester.headers,
      f.fixture.choice,
    )
  )[20];
  if (!move) throw new Error("Required replacement fixture slot unavailable.");
  // The receipt must use the account behind the authenticated requester headers.
  const requesterAccount = (
    await f.world.owner.pool.query<{ id: string; timezone: string }>(
      'SELECT id,timezone FROM "user" WHERE id=$1',
      [f.fixture.requester.id],
    )
  ).rows[0];
  expect(requesterAccount).toMatchObject({
    id: f.fixture.requester.id,
    timezone: expect.any(String),
  });
  current = await changePolicyBooking(
    f.fixture.context,
    f.fixture.requester.headers,
    replaced.id,
    "reschedule",
    {
      requestId: randomUUID(),
      expectedRevision: replaced.workflowRevision,
      reasonCode: "synthetic_participant_change",
      startAtUtc: move.startAtUtc,
      endAtUtc: move.endAtUtc,
      displayTimezone: requesterAccount.timezone,
    },
  );
  current = await changePolicyBooking(
    f.fixture.context,
    f.reviewer.headers,
    current.id,
    "confirm",
    {
      requestId: randomUUID(),
      expectedRevision: current.workflowRevision,
      reasonCode: "synthetic_prerequisite_review",
    },
  );
  const selfBooking = await reserve(ownSelf.requester, ownSelf.learner.id);
  await grantWorkflowTask(f.world, selfBooking.logicalBookingId, f.reviewer, [
    "confirm",
  ]);
  cancelled = await changePolicyBooking(
    f.fixture.context,
    ownSelf.requester.headers,
    selfBooking.id,
    "cancel",
    {
      requestId: randomUUID(),
      expectedRevision: selfBooking.workflowRevision,
      reasonCode: "synthetic_participant_change",
    },
  );
  ungranted = await reserve(f.fixture.requester, f.fixture.learner.id);
  foreignBooking = await reserve(foreign.requester, foreign.learner.id);
  await grantWorkflowTask(
    f.world,
    foreignBooking.logicalBookingId,
    f.reviewer,
    ["confirm"],
  );
  // Explicit historical provisional fixture: exercise effective expiry without
  // changing application time, expiring rows or claiming a fresh booking elapsed.
  const now = Date.now();
  expired = await historicalWorkflowBooking(f.world, f.fixture, f.reviewer, {
    state: "provisional",
    start: new Date(now + 5 * 86400000),
    end: new Date(now + 5 * 86400000 + 3600000),
    created: new Date(now - 86400000),
    expires: new Date(now - 86400000 + 600000),
  });
  await grantWorkflowTask(f.world, expired.logicalBookingId, f.reviewer, [
    "confirm",
  ]);
  // Legitimate additional Admin roles and actual provider MFA still must not
  // turn an actor's own family/Tutor relationship into staff record authority.
  for (const actor of [f.fixture.requester, f.fixture.tutor]) {
    await f.world.owner.pool.query(
      "INSERT INTO user_roles(user_id,role) VALUES($1,'admin')",
      [actor.id],
    );
    const cookie = await enrollTestAdmin(
      f.world.runtime,
      actor.cookie,
      password,
    );
    const staff = { ...actor, cookie, headers: new Headers({ cookie }) };
    if (actor.id === f.fixture.requester.id) requesterStaff = staff;
    else tutorStaff = staff;
    await grantWorkflowTask(f.world, current.logicalBookingId, staff, [
      "confirm",
    ]);
  }
  f.activate([ownSelf.requester]);
  await savePrivateMeetingLink(
    f.world.runtime,
    tutorStaff.headers,
    current.id,
    { requestId: randomUUID(), expectedRevision: 0, url: meeting },
  );
}, 60000);
beforeEach(() => f.activate([ownSelf.requester]));
afterAll(async () => {
  await f?.close();
});
const context = () => f.fixture.context;
const ids = (rows: { id: string }[]) => rows.map((row) => row.id).sort();

describe("private assigned staff booking lookup on actual PostgreSQL", () => {
  it("lists only current exact grants and returns minimal self/guardian participant context", async () => {
    const result = await listStaffBookings(context(), f.reviewer.headers);
    expect(ids(result.items)).toEqual(
      [replaced.id, current.id, cancelled.id, expired.id].sort(),
    );
    expect(result).toMatchObject({ page: 1, pageSize: 20, hasMore: false });
    const self = await readPrivateStaffBooking(
      context(),
      f.reviewer.headers,
      cancelled.id,
    );
    expect(self).toMatchObject({
      state: "cancelled",
      relationship: "self",
      learnerLevel: "college_support",
      learnerName: ownSelf.learner.displayName,
      requesterName: ownSelf.requester.name,
      tutorName: f.fixture.tutor.name,
    });
    const guardian = await readWorkflowTask(
      context(),
      f.reviewer.headers,
      current.id,
    );
    expect(guardian).toMatchObject({
      state: "confirmed",
      relationship: "guardian",
      learnerLevel: "high_school",
      requesterName: f.fixture.requester.name,
    });
    const serialized = JSON.stringify([result, self, guardian]);
    for (const secret of [
      meeting,
      f.reviewer.email,
      f.fixture.requester.email,
      f.fixture.tutor.email,
      ownSelf.requester.email,
      f.fixture.requester.id,
      ownSelf.requester.id,
      f.fixture.tutor.id,
    ])
      expect(serialized).not.toContain(secret);
    expect(serialized).not.toMatch(
      /meeting|cookie|email|userId|contact|evidence/i,
    );
  });
  it("pages the authorized set deterministically without repeats or grant-count inflation", async () => {
    const first = await listStaffBookings(context(), f.reviewer.headers, {
      pageSize: 2,
    });
    const second = await listStaffBookings(context(), f.reviewer.headers, {
      pageSize: 2,
      page: 2,
    });
    expect(first.hasMore).toBe(true);
    expect(second.hasMore).toBe(false);
    expect(ids([...first.items, ...second.items])).toEqual(
      [replaced.id, current.id, cancelled.id, expired.id].sort(),
    );
    expect(
      new Set([...first.items, ...second.items].map((row) => row.id)).size,
    ).toBe(4);
    expect(
      (
        await listStaffBookings(context(), f.reviewer.headers, {
          page: 1000,
          pageSize: 2,
        })
      ).items,
    ).toEqual([]);
  });
  it("filters exact row IDs/effective states while retaining logical replacement history", async () => {
    for (const [receipt, state] of [
      [replaced, "replaced"],
      [current, "confirmed"],
      [cancelled, "cancelled"],
      [expired, "expired"],
    ] as const) {
      const result = await listStaffBookings(context(), f.reviewer.headers, {
        q: receipt.id,
        state,
      });
      expect(result.items.map((row) => row.id)).toEqual([receipt.id]);
      expect(result.items[0].state).toBe(state);
    }
    const old = await readPrivateStaffBooking(
      context(),
      f.reviewer.headers,
      replaced.id,
    );
    const next = await readPrivateStaffBooking(
      context(),
      f.reviewer.headers,
      current.id,
    );
    expect(next.logicalBookingId).toBe(old.logicalBookingId);
    expect(next.revision).toBe(old.revision + 1);
    expect(
      (
        await listStaffBookings(context(), f.reviewer.headers, {
          q: randomUUID(),
        })
      ).items,
    ).toEqual([]);
    expect(
      (
        await listStaffBookings(context(), f.reviewer.headers, {
          q: current.id,
          state: "cancelled",
        })
      ).items,
    ).toEqual([]);
  });
  it("projects expired provisional status without mutating bookings, events or delivery records", async () => {
    const snapshot = async () =>
      (
        await f.world.owner.pool.query(
          "SELECT row_to_json(b) booking,(SELECT jsonb_agg(e ORDER BY e.created_at,e.id) FROM booking_lifecycle_events e WHERE e.logical_booking_id=b.logical_booking_id) events FROM bookings b WHERE b.id=$1",
          [expired.id],
        )
      ).rows;
    const before = await snapshot();
    expect(
      (await readPrivateStaffBooking(context(), f.reviewer.headers, expired.id))
        .state,
    ).toBe("expired");
    expect(
      (
        await listStaffBookings(context(), f.reviewer.headers, {
          state: "expired",
        })
      ).items.map((row) => row.id),
    ).toEqual([expired.id]);
    expect(await snapshot()).toEqual(before);
    expect(before[0].booking.state).toBe("provisional");
  });
  it("does not let packet membership, Admin role or participant identity substitute for an assignment", async () => {
    expect(
      (await listStaffBookings(context(), f.unassigned.headers)).items,
    ).toEqual([]);
    await expect(
      readPrivateStaffBooking(context(), f.unassigned.headers, current.id),
    ).rejects.toMatchObject({ status: 404 });
    for (const id of [ungranted.id, foreignBooking.id, randomUUID()]) {
      await expect(
        readPrivateStaffBooking(context(), f.reviewer.headers, id),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        (await listStaffBookings(context(), f.reviewer.headers, { q: id }))
          .items,
      ).toEqual([]);
    }
    await expect(
      listStaffBookings(context(), ownSelf.requester.headers),
    ).rejects.toMatchObject({ status: 403 });
    for (const actor of [requesterStaff, tutorStaff]) {
      expect((await listStaffBookings(context(), actor.headers)).items).toEqual(
        [],
      );
      await expect(
        readPrivateStaffBooking(context(), actor.headers, current.id),
      ).rejects.toMatchObject({ status: 404 });
    }
  });
  it.each(["revoked", "expired"])(
    "a %s assignment disappears from list and detail",
    async (kind) => {
      const prior = (
        await f.world.owner.pool.query(
          "SELECT active,valid_until FROM booking_workflow_grants WHERE logical_booking_id=$1 AND actor_user_id=$2 AND action='confirm'",
          [current.logicalBookingId, f.reviewer.id],
        )
      ).rows[0];
      try {
        await f.world.owner.pool.query(
          "UPDATE booking_workflow_grants SET active=$3,valid_until=$4 WHERE logical_booking_id=$1 AND actor_user_id=$2 AND action='confirm'",
          [
            current.logicalBookingId,
            f.reviewer.id,
            kind !== "revoked",
            kind === "expired"
              ? new Date(Date.now() - 60000)
              : prior.valid_until,
          ],
        );
        expect(
          (
            await listStaffBookings(context(), f.reviewer.headers, {
              q: current.id,
            })
          ).items,
        ).toEqual([]);
        await expect(
          readPrivateStaffBooking(context(), f.reviewer.headers, current.id),
        ).rejects.toMatchObject({ status: 404 });
      } finally {
        await f.world.owner.pool.query(
          "UPDATE booking_workflow_grants SET active=$3,valid_until=$4 WHERE logical_booking_id=$1 AND actor_user_id=$2 AND action='confirm'",
          [
            current.logicalBookingId,
            f.reviewer.id,
            prior.active,
            prior.valid_until,
          ],
        );
      }
    },
  );
  it.each(["requester", "tutor", "actor"])(
    "current packet membership is required for the %s",
    async (kind) => {
      const removed =
        kind === "requester"
          ? f.fixture.requester
          : kind === "tutor"
            ? f.fixture.tutor
            : f.reviewer;
      writeFileSync(
        f.file,
        JSON.stringify({
          ...f.packet,
          accountEmails: [
            ...f.packet.accountEmails,
            ownSelf.requester.email,
          ].filter((email) => email !== removed.email),
        }),
        { mode: 0o600 },
      );
      if (kind === "actor")
        await expect(
          listStaffBookings(context(), f.reviewer.headers),
        ).rejects.toMatchObject({ status: 403 });
      else {
        expect(
          (
            await listStaffBookings(context(), f.reviewer.headers, {
              q: current.id,
            })
          ).items,
        ).toEqual([]);
        await expect(
          readPrivateStaffBooking(context(), f.reviewer.headers, current.id),
        ).rejects.toMatchObject({ status: 404 });
      }
    },
  );
  it.each(["booking", "screening", "admission"])(
    "requires the current %s policy head",
    async (kind) => {
      const statement =
        kind === "booking"
          ? "UPDATE booking_workflow_policy_head SET enabled=$1 WHERE policy_id=$2"
          : kind === "screening"
            ? "UPDATE tutor_screening_policy_heads SET status=$1 WHERE version=$2"
            : "UPDATE learner_admission_policy_state SET enabled=$1 WHERE current_policy_id=$2";
      const id =
        kind === "booking"
          ? f.fixture.booking.policyId
          : kind === "screening"
            ? f.fixture.policy.version
            : f.fixture.admission.policyId;
      try {
        await f.world.owner.pool.query(statement, [
          kind === "screening" ? "revoked" : false,
          id,
        ]);
        expect(
          (
            await listStaffBookings(context(), f.reviewer.headers, {
              q: current.id,
            })
          ).items,
        ).toEqual([]);
        await expect(
          readPrivateStaffBooking(context(), f.reviewer.headers, current.id),
        ).rejects.toMatchObject({ status: 404 });
      } finally {
        await f.world.owner.pool.query(statement, [
          kind === "screening" ? "enabled" : true,
          id,
        ]);
      }
    },
  );
  it("retains assigned historical reads but offers controls only in their allowed state and time", async () => {
    for (const receipt of [replaced, current, cancelled, expired])
      expect(
        (
          await readPrivateStaffBooking(
            context(),
            f.reviewer.headers,
            receipt.id,
          )
        ).actions,
      ).toEqual([]);
    await grantWorkflowTask(f.world, ungranted.logicalBookingId, f.reviewer, [
      "confirm",
    ]);
    try {
      expect(
        (
          await readPrivateStaffBooking(
            context(),
            f.reviewer.headers,
            ungranted.id,
          )
        ).actions,
      ).toEqual(["confirm"]);
    } finally {
      await f.world.owner.pool.query(
        "UPDATE booking_workflow_grants SET active=false WHERE logical_booking_id=$1 AND actor_user_id=$2",
        [ungranted.logicalBookingId, f.reviewer.id],
      );
    }
    const now = Date.now();
    const ended = await historicalWorkflowBooking(
      f.world,
      f.fixture,
      f.reviewer,
      {
        state: "confirmed",
        start: new Date(now - 7200000),
        end: new Date(now - 3600000),
        created: new Date(now - 86400000),
        expires: new Date(now - 86400000 + 600000),
      },
    );
    await grantWorkflowTask(f.world, ended.logicalBookingId, f.reviewer, [
      "confirm",
      "no_show",
      "complete",
    ]);
    expect(
      (await readPrivateStaffBooking(context(), f.reviewer.headers, ended.id))
        .actions,
    ).toEqual(["no_show"]);
  });
  it("denies lost beneficiary authority and current MFA without rewriting saved records", async () => {
    const before = (
      await f.world.owner.pool.query(
        "SELECT row_to_json(b) booking FROM bookings b WHERE b.id=$1",
        [current.id],
      )
    ).rows;
    const admission = await readAssignedAdmission(
      f.fixture.admissionContext,
      f.reviewer.headers,
      f.fixture.admissionId,
    );
    await mutateAdmissionReview(
      f.fixture.admissionContext,
      f.reviewer.headers,
      admission.id,
      "decision",
      {
        requestId: randomUUID(),
        revision: admission.revision,
        action: "revoke",
      },
    );
    expect(
      (
        await listStaffBookings(context(), f.reviewer.headers, {
          q: current.id,
        })
      ).items,
    ).toEqual([]);
    await expect(
      readPrivateStaffBooking(context(), f.reviewer.headers, current.id),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await f.world.owner.pool.query(
          "SELECT row_to_json(b) booking FROM bookings b WHERE b.id=$1",
          [current.id],
        )
      ).rows,
    ).toEqual(before);
    const receipts = (
      await f.world.owner.pool.query(
        "SELECT session_id,verified_at FROM admin_assurance_receipts WHERE user_id=$1",
        [f.reviewer.id],
      )
    ).rows;
    try {
      await f.world.owner.pool.query(
        "UPDATE admin_assurance_receipts SET verified_at=clock_timestamp()-interval '9 hours' WHERE user_id=$1",
        [f.reviewer.id],
      );
      await expect(
        listStaffBookings(context(), f.reviewer.headers),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      for (const receipt of receipts)
        await f.world.owner.pool.query(
          "UPDATE admin_assurance_receipts SET verified_at=$3 WHERE user_id=$1 AND session_id=$2",
          [f.reviewer.id, receipt.session_id, receipt.verified_at],
        );
    }
  });
  it("keeps strict GET/origin/query/no-packet boundaries and private response headers", async () => {
    const get = (query = "", options = {}) =>
      handleStaffBookingList(
        f.world.runtime,
        jsonRequest(f.world, `/api/admin/bookings${query}`, {
          method: "GET",
          cookie: f.reviewer.cookie,
          ...options,
        }),
      );
    const good = await get("?pageSize=2");
    expect(good.status).toBe(200);
    expect(good.headers.get("cache-control")).toContain("no-store");
    for (const query of [
      "?q=not-a-uuid",
      "?state=paid",
      "?pageSize=21",
      "?page=1&page=1",
      "?role=admin",
      "?learnerId=" + f.fixture.learner.id,
    ])
      expect((await get(query)).status).toBe(400);
    expect((await get("", { origin: "https://unrelated.test" })).status).toBe(
      403,
    );
    expect((await get("", { method: "POST" })).status).toBe(405);
    expect(
      (
        await handleStaffBookingList(
          f.world.runtime,
          jsonRequest(f.world, "/api/admin/bookings", { method: "GET" }),
        )
      ).status,
    ).toBe(401);
    f.disable();
    try {
      expect((await get()).status).toBe(503);
    } finally {
      f.activate([ownSelf.requester]);
    }
  });
});
