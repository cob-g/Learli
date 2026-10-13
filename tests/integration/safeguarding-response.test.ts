import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  openWorld,
  closeWorld,
  createAccount,
  type TestAccount,
  type World,
} from "./support";
import { responseFixture, observedLock } from "./screening-fixtures";
import {
  createSafeguardingCase,
  changeSafeguardingResponse,
  readSafeguardingCase,
  listSafeguardingCases,
  changeSafetyRestriction,
} from "@/features/safeguarding/service";
import {
  provisionResponseStaff,
  provisionResponseGrant,
  provisionSafetyRestriction,
} from "@/features/safeguarding/fixture-tooling";
let w: World,
  reviewer: TestAccount,
  escalation: TestAccount,
  dispatcher: TestAccount,
  restriction: TestAccount,
  requester: TestAccount,
  f: Awaited<ReturnType<typeof responseFixture>>,
  caseId: string;
const command = (
  revision: number,
  action: string,
  targetId?: string,
  key = randomUUID(),
) => ({ revision, action, requestKey: key, ...(targetId ? { targetId } : {}) });
beforeAll(async () => {
  w = openWorld();
  reviewer = await createAccount(
    w,
    ["admin"],
    "Fictional responsible reviewer",
  );
  escalation = await createAccount(w, ["admin"], "Fictional escalation owner");
  dispatcher = await createAccount(w, ["admin"], "Fictional exact dispatcher");
  restriction = await createAccount(
    w,
    ["admin"],
    "Fictional restriction actor",
  );
}, 60000);
beforeEach(async () => {
  f = await responseFixture(w, reviewer, escalation);
  requester = await createAccount(w, ["parent"], "Fictional concern requester");
  caseId = (
    await createSafeguardingCase(f.context, requester.headers, {
      category: "safety",
      subject: "Fictional private subject",
      body: "Fictional private concern body, no learner or meeting data.",
      requestKey: randomUUID(),
    })
  ).id;
  await provisionResponseGrant(
    w.owner,
    caseId,
    dispatcher.id,
    "dispatcher",
    f.expiry,
  );
  await provisionResponseGrant(
    w.owner,
    caseId,
    reviewer.id,
    "reviewer_choice",
    f.expiry,
  );
  await provisionResponseGrant(
    w.owner,
    caseId,
    escalation.id,
    "reviewer_choice",
    f.expiry,
    "authorized",
    true,
  );
}, 30000);
afterAll(async () => {
  await w.owner.pool.query(
    "UPDATE support_response_policy_heads SET status='revoked'",
  );
  await closeWorld(w);
});
async function assign() {
  return changeSafeguardingResponse(
    f.context,
    dispatcher.headers,
    caseId,
    command(0, "assign", reviewer.id),
  );
}
describe("actual PostgreSQL assigned staffed-response software", () => {
  it("disabled intake refuses before parsing or storing body", async () => {
    const before = (
      await w.owner.pool.query("SELECT count(*)::int n FROM support_cases")
    ).rows[0].n;
    await expect(
      createSafeguardingCase(
        { ...f.context, safeguarding: { mode: "disabled" } },
        requester.headers,
        { body: "private unapproved body" },
      ),
    ).rejects.toMatchObject({ status: 503 });
    expect(
      (await w.owner.pool.query("SELECT count(*)::int n FROM support_cases"))
        .rows[0].n,
    ).toBe(before);
  });
  it("missing/revoked owner disables intake; owner alone confers no case authority", async () => {
    await provisionResponseStaff(w.owner, reviewer.id, f.expiry, "revoked");
    await expect(
      createSafeguardingCase(f.context, requester.headers, {
        category: "safety",
        subject: "Fictional",
        body: "Fictional",
        requestKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      readSafeguardingCase(f.context, reviewer.headers, caseId, "reviewer"),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("dispatch queue has metadata only and direct body route denies", async () => {
    const queue = await listSafeguardingCases(
      f.context,
      dispatcher.headers,
      "dispatcher",
    );
    expect(queue).toHaveLength(1);
    expect(JSON.stringify(queue)).not.toMatch(
      /private subject|private concern|requesterUserId|learner|bookingId|meeting|body|subject/,
    );
    const detail = await readSafeguardingCase(
      f.context,
      dispatcher.headers,
      caseId,
      "dispatcher",
    );
    expect(detail).not.toHaveProperty("body");
    expect(detail).not.toHaveProperty("subject");
    await expect(
      readSafeguardingCase(f.context, dispatcher.headers, caseId, "reviewer"),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("exact assignment, acknowledge, escalation transfer and old reviewer denial", async () => {
    await assign();
    await expect(
      changeSafeguardingResponse(
        f.context,
        reviewer.headers,
        caseId,
        command(1, "close"),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await changeSafeguardingResponse(
      f.context,
      reviewer.headers,
      caseId,
      command(1, "acknowledge"),
    );
    await changeSafeguardingResponse(
      f.context,
      reviewer.headers,
      caseId,
      command(2, "request_escalation", escalation.id),
    );
    await changeSafeguardingResponse(
      f.context,
      dispatcher.headers,
      caseId,
      command(3, "escalate", escalation.id),
    );
    for (const action of ["acknowledge", "close", "reopen"])
      await expect(
        changeSafeguardingResponse(
          f.context,
          reviewer.headers,
          caseId,
          command(4, action),
        ),
      ).rejects.toMatchObject({ status: 404 });
    await expect(
      readSafeguardingCase(f.context, reviewer.headers, caseId, "reviewer"),
    ).rejects.toMatchObject({ status: 404 });
    const next = await readSafeguardingCase(
      f.context,
      escalation.headers,
      caseId,
      "reviewer",
    );
    expect(next).toMatchObject({
      revision: 4,
      acknowledgedAt: null,
      escalationRequestedAt: null,
      body: "Fictional private concern body, no learner or meeting data.",
    });
    await changeSafeguardingResponse(
      f.context,
      escalation.headers,
      caseId,
      command(4, "acknowledge"),
    );
  });
  it("self/requester/arbitrary reviewer choices cannot be assigned", async () => {
    await expect(
      changeSafeguardingResponse(
        f.context,
        dispatcher.headers,
        caseId,
        command(0, "assign", dispatcher.id),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      changeSafeguardingResponse(
        f.context,
        dispatcher.headers,
        caseId,
        command(0, "assign", requester.id),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      changeSafeguardingResponse(
        f.context,
        dispatcher.headers,
        caseId,
        command(0, "assign", restriction.id),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("escalation requires acknowledgment and named exact escalation flag", async () => {
    await assign();
    await expect(
      changeSafeguardingResponse(
        f.context,
        reviewer.headers,
        caseId,
        command(1, "request_escalation", escalation.id),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await changeSafeguardingResponse(
      f.context,
      reviewer.headers,
      caseId,
      command(1, "acknowledge"),
    );
    await provisionResponseGrant(
      w.owner,
      caseId,
      escalation.id,
      "reviewer_choice",
      f.expiry,
      "authorized",
      false,
    );
    await expect(
      changeSafeguardingResponse(
        f.context,
        reviewer.headers,
        caseId,
        command(2, "request_escalation", escalation.id),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("reopen starts a new response cycle and requires new acknowledgment", async () => {
    await assign();
    await changeSafeguardingResponse(
      f.context,
      reviewer.headers,
      caseId,
      command(1, "acknowledge"),
    );
    await changeSafeguardingResponse(
      f.context,
      reviewer.headers,
      caseId,
      command(2, "close"),
    );
    await expect(
      changeSafeguardingResponse(
        f.context,
        dispatcher.headers,
        caseId,
        command(3, "reassign", escalation.id),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await changeSafeguardingResponse(
      f.context,
      reviewer.headers,
      caseId,
      command(3, "reopen"),
    );
    expect(
      await readSafeguardingCase(
        f.context,
        reviewer.headers,
        caseId,
        "reviewer",
      ),
    ).toMatchObject({ status: "in_review", acknowledgedAt: null, revision: 4 });
    await expect(
      changeSafeguardingResponse(
        f.context,
        reviewer.headers,
        caseId,
        command(4, "close"),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await changeSafeguardingResponse(
      f.context,
      reviewer.headers,
      caseId,
      command(4, "acknowledge"),
    );
  });
  it("concurrent identical assignment saves once and conflicting replay denies", async () => {
    const input = command(0, "assign", reviewer.id);
    const r = await Promise.all([
      changeSafeguardingResponse(f.context, dispatcher.headers, caseId, input),
      changeSafeguardingResponse(f.context, dispatcher.headers, caseId, input),
    ]);
    expect(r.map((x) => x.replayed).sort()).toEqual([false, true]);
    await expect(
      changeSafeguardingResponse(f.context, dispatcher.headers, caseId, {
        ...input,
        targetId: escalation.id,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("grant revocation after an actual case lock wait denies assignment without a receipt", async () => {
    const lock = await w.owner.pool.connect();
    await lock.query("BEGIN");
    await lock.query("SELECT id FROM support_cases WHERE id=$1 FOR UPDATE", [
      caseId,
    ]);
    const pending = changeSafeguardingResponse(
      f.context,
      dispatcher.headers,
      caseId,
      command(0, "assign", reviewer.id),
    );
    try {
      await observedLock(w, "change_safeguarding_response");
      await w.owner.pool.query(
        "UPDATE support_dispatch_grants SET status='revoked' WHERE case_id=$1 AND dispatcher_user_id=$2",
        [caseId, dispatcher.id],
      );
      await lock.query("COMMIT");
      await expect(pending).rejects.toMatchObject({ status: 404 });
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
    }
    expect(
      (
        await w.owner.pool.query(
          "SELECT revision FROM support_cases WHERE id=$1",
          [caseId],
        )
      ).rows[0].revision,
    ).toBe(0);
  });
  it("expiry/revoked replay denies; requester can still read own stored concern after disabled intake", async () => {
    await assign();
    await w.owner.pool.query(
      "UPDATE support_dispatch_grants SET valid_until=clock_timestamp()-interval '1 second' WHERE case_id=$1",
      [caseId],
    );
    await expect(
      changeSafeguardingResponse(
        f.context,
        dispatcher.headers,
        caseId,
        command(1, "reassign", escalation.id),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await w.owner.pool.query(
      "UPDATE support_response_policy_heads SET status='revoked'",
    );
    expect(
      await readSafeguardingCase(
        { ...f.context, safeguarding: { mode: "disabled" } },
        requester.headers,
        caseId,
        "requester",
      ),
    ).toHaveProperty("body");
    await expect(
      readSafeguardingCase(f.context, restriction.headers, caseId, "requester"),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("independent exact restriction grant suspends and restores without support reviewer membership", async () => {
    await provisionSafetyRestriction(
      w.owner,
      restriction.id,
      requester.id,
      f.expiry,
    );
    const key = randomUUID();
    expect(
      await changeSafetyRestriction(
        f.context,
        restriction.headers,
        requester.id,
        {
          action: "restrict",
          reason: "synthetic_safety_restrict",
          revision: 0,
          requestKey: key,
        },
      ),
    ).toMatchObject({ revision: 1 });
    expect(
      (
        await w.owner.pool.query(
          "SELECT status FROM user_access WHERE user_id=$1",
          [requester.id],
        )
      ).rows[0].status,
    ).toBe("suspended");
    await expect(
      changeSafetyRestriction(f.context, dispatcher.headers, requester.id, {
        action: "restore",
        reason: "synthetic_safety_restore",
        revision: 1,
        requestKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 404 });
    await changeSafetyRestriction(
      f.context,
      restriction.headers,
      requester.id,
      {
        action: "restore",
        reason: "synthetic_safety_restore",
        revision: 1,
        requestKey: randomUUID(),
      },
    );
    expect(
      (
        await w.owner.pool.query(
          "SELECT status FROM user_access WHERE user_id=$1",
          [requester.id],
        )
      ).rows[0].status,
    ).toBe("active");
  });
  it("direct runtime intake/assignment/account writes fail and historical source collision refuses provisioning", async () => {
    await expect(
      w.runtime.pool.query(
        "UPDATE support_cases SET status='closed' WHERE id=$1",
        [caseId],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      w.runtime.pool.query(
        "UPDATE user_access SET status='suspended' WHERE user_id=$1",
        [requester.id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      w.runtime.pool.query(
        "UPDATE support_reviewers SET status='authorized' WHERE user_id=$1",
        [dispatcher.id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await w.owner.pool.query(
      "INSERT INTO support_reviewers(user_id,source,status) VALUES($1,'local_fixture','authorized')",
      [restriction.id],
    );
    await expect(
      provisionResponseStaff(w.owner, restriction.id, f.expiry),
    ).rejects.toThrow("Source collision");
  });
});
