import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { handleSupportRequest } from "@/features/support/handler";
import {
  createCase,
  readCase,
  changeCaseStatus,
  listCases,
} from "@/features/support/service";
import {
  assignFixtureCase,
  authorizeFixtureReviewer,
  revokeFixtureReviewer,
} from "@/features/support/fixture-tooling";
import {
  supportCases,
  supportCaseEvents,
  supportReviewerEvents,
  user,
  userAccess,
  userRoles,
} from "@/lib/db/schema";
import {
  createAccount,
  openWorld,
  closeWorld,
  jsonRequest,
  type TestAccount,
  type World,
} from "./support";
let world: World,
  requester: TestAccount,
  other: TestAccount,
  reviewer: TestAccount,
  reviewerB: TestAccount,
  admin: TestAccount;
let caseId: string, otherCase: string;
const values = () => ({
  requestKey: randomUUID(),
  category: "safety",
  subject: "Fictional case",
  body: "Synthetic-only report text <script>window.fake=true</script>",
});
function request(
  account?: TestAccount,
  scope: "requester" | "reviewer" = "requester",
  id?: string,
  body?: unknown,
  status = false,
) {
  return handleSupportRequest(
    world.runtime,
    jsonRequest(
      world,
      `/api/${scope === "reviewer" ? "admin/" : ""}support${id ? `/${id}` : ""}${status ? "/status" : ""}`,
      {
        method: body === undefined ? "GET" : status ? "PATCH" : "POST",
        cookie: account?.cookie,
        body,
      },
    ),
    scope,
    id,
    status,
  );
}
async function fresh() {
  const account = await createAccount(world);
  return {
    account,
    id: (await createCase(world.runtime, account.headers, values())).id,
  };
}
beforeAll(async () => {
  world = openWorld();
  await world.owner.pool.query("UPDATE rate_limit SET count=0");
  requester = await createAccount(world, ["parent"]);
  other = await createAccount(world, ["tutor"]);
  reviewer = await createAccount(world, ["admin"]);
  reviewerB = await createAccount(world, ["admin"]);
  admin = await createAccount(world, ["admin"]);
  await authorizeFixtureReviewer(world.owner, reviewer.id);
  await authorizeFixtureReviewer(world.owner, reviewerB.id);
  caseId = (await createCase(world.runtime, requester.headers, values())).id;
  otherCase = (await createCase(world.runtime, other.headers, values())).id;
  await assignFixtureCase(world.owner, caseId, reviewer.id);
  await assignFixtureCase(world.owner, otherCase, reviewerB.id);
}, 30000);
beforeEach(async () => {
  // Each isolated test gets a fresh fixture-signup budget; app throttles stay on.
  await world.owner.pool.query("UPDATE rate_limit SET count=0");
});
afterAll(() => closeWorld(world));

describe("case-specific local support with real PostgreSQL", () => {
  it.each(["read", "status", "create"] as const)(
    "denies queued %s after caller-session revocation without partial changes",
    async (operation) => {
      const account = await createAccount(
        world,
        operation === "create" ? [] : ["admin"],
      );
      const reportOwner = await createAccount(world);
      const report = (
        await createCase(world.runtime, reportOwner.headers, values())
      ).id;
      if (operation !== "create") {
        await authorizeFixtureReviewer(world.owner, account.id);
        await assignFixtureCase(world.owner, report, account.id);
      }
      const before = (
        await world.owner.pool.query(
          "SELECT status,revision,(SELECT count(*)::int FROM support_case_events WHERE case_id=$1) AS events FROM support_cases WHERE id=$1",
          [report],
        )
      ).rows[0];
      const blocker = await world.owner.pool.connect();
      try {
        await blocker.query("BEGIN");
        if (operation === "create")
          await blocker.query(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
            [`support:${account.id}`],
          );
        else
          await blocker.query(
            "SELECT id FROM support_cases WHERE id=$1 FOR UPDATE",
            [report],
          );
        const pending =
          operation === "create"
            ? request(account, "requester", undefined, values())
            : operation === "status"
              ? request(
                  account,
                  "reviewer",
                  report,
                  { revision: 1, status: "in_review" },
                  true,
                )
              : request(account, "reviewer", report);
        let observed = false;
        for (let i = 0; i < 100; i++) {
          const waiting = await world.owner.pool.query(
            "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND (query LIKE '%support_cases%' OR query LIKE '%pg_advisory_xact_lock%')",
          );
          if (waiting.rows[0].n > 0) {
            observed = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(observed).toBe(true);
        await blocker.query("DELETE FROM session WHERE user_id=$1", [
          account.id,
        ]);
        await blocker.query("COMMIT");
        expect((await pending).status).toBe(401);
        const after = (
          await world.owner.pool.query(
            "SELECT status,revision,(SELECT count(*)::int FROM support_case_events WHERE case_id=$1) AS events FROM support_cases WHERE id=$1",
            [report],
          )
        ).rows[0];
        expect(after).toEqual(before);
        if (operation === "create")
          expect(
            (
              await world.owner.pool.query(
                "SELECT count(*)::int AS n FROM support_cases WHERE requester_user_id=$1",
                [account.id],
              )
            ).rows[0].n,
          ).toBe(0);
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
      }
    },
  );

  it("requester list/detail/history exposes own case only with a minimal safe shape", async () => {
    const result = await listCases(
      world.runtime,
      requester.headers,
      "requester",
    );
    expect(result.cases.map((r) => r.id)).toEqual([caseId]);
    expect(result.cases[0]).not.toHaveProperty("body");
    const detail = await readCase(
      world.runtime,
      requester.headers,
      caseId,
      "requester",
    );
    expect(Object.keys(detail).sort()).toEqual([
      "body",
      "category",
      "createdAt",
      "history",
      "id",
      "revision",
      "status",
      "subject",
      "updatedAt",
    ]);
    expect(detail.history.map((e) => e.action)).toEqual([
      "created",
      "assigned",
    ]);
    expect(JSON.stringify(detail.history)).not.toContain(reviewer.id);
    expect(JSON.stringify(detail.history)).not.toContain(requester.id);
  });
  it("denies cross-requester and malformed/nonexistent IDs identically", async () => {
    for (const id of [otherCase, randomUUID(), "bad-id"]) {
      const response = await request(requester, "requester", id);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        message: "This account is not available.",
      });
    }
  });
  it("preauthorized reviewers see only exact assigned cases and cannot use an admin bypass", async () => {
    expect(
      (await listCases(world.runtime, reviewer.headers, "reviewer")).cases.map(
        (c) => c.id,
      ),
    ).toEqual([caseId]);
    expect((await request(reviewerB, "reviewer", caseId)).status).toBe(404);
    expect((await request(reviewer, "reviewer", otherCase)).status).toBe(404);
    expect((await request(admin, "reviewer", caseId)).status).toBe(403);
    expect((await request(admin, "requester", caseId)).status).toBe(404);
  });
  it("denies unauthenticated, requester status edits and forged role/assignment fields", async () => {
    expect((await request(undefined)).status).toBe(401);
    expect((await request(undefined, "reviewer", caseId)).status).toBe(401);
    expect(
      (
        await request(
          requester,
          "reviewer",
          caseId,
          { revision: 1, status: "in_review" },
          true,
        )
      ).status,
    ).toBe(403);
    for (const key of [
      "reviewerUserId",
      "requesterUserId",
      "role",
      "assignment",
      "status",
      "source",
      "bookingId",
    ])
      expect(
        (
          await request(requester, "requester", undefined, {
            ...values(),
            [key]: reviewer.id,
          })
        ).status,
      ).toBe(400);
    expect(
      (
        await request(
          reviewer,
          "reviewer",
          caseId,
          { revision: 1, status: "in_review", reviewerId: reviewer.id },
          true,
        )
      ).status,
    ).toBe(400);
    const forged = jsonRequest(
      world,
      `/api/admin/support/${caseId}/assignment`,
      {
        method: "PATCH",
        body: { reviewerId: reviewer.id },
        cookie: reviewer.cookie,
      },
    );
    expect(
      (await handleSupportRequest(world.runtime, forged, "reviewer", caseId))
        .status,
    ).toBe(405);
  });
  it("executes approved status transitions and reopening, rejects skips/stale revisions", async () => {
    expect(
      (
        await request(
          reviewer,
          "reviewer",
          caseId,
          { revision: 1, status: "closed" },
          true,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          reviewer,
          "reviewer",
          caseId,
          { revision: 0, status: "in_review" },
          true,
        )
      ).status,
    ).toBe(409);
    for (const [revision, status] of [
      [1, "in_review"],
      [2, "closed"],
      [3, "in_review"],
    ] as const)
      expect(
        (
          await request(
            reviewer,
            "reviewer",
            caseId,
            { revision, status },
            true,
          )
        ).status,
      ).toBe(200);
    expect(
      (
        await readCase(world.runtime, requester.headers, caseId, "requester")
      ).history.map((e) => e.nextStatus),
    ).toEqual(["open", null, "in_review", "closed", "in_review"]);
    const unchanged = await changeCaseStatus(
      world.runtime,
      reviewer.headers,
      caseId,
      { revision: 4, status: "in_review" },
    );
    expect(unchanged.revision).toBe(4);
  });
  it("two concurrent status edits have one winner and one event", async () => {
    const { id } = await fresh();
    await assignFixtureCase(world.owner, id, reviewer.id);
    const outcomes = await Promise.all([
      request(
        reviewer,
        "reviewer",
        id,
        { revision: 1, status: "in_review" },
        true,
      ),
      request(
        reviewer,
        "reviewer",
        id,
        { revision: 1, status: "in_review" },
        true,
      ),
    ]);
    expect(outcomes.map((r) => r.status).sort()).toEqual([200, 409]);
    const detail = await readCase(
      world.runtime,
      reviewer.headers,
      id,
      "reviewer",
    );
    expect(detail.revision).toBe(2);
    expect(
      detail.history.filter((e) => e.action === "status_changed"),
    ).toHaveLength(1);
  });
  it("reassignment immediately denies the previous reviewer, changes revision and records safe history", async () => {
    const { id, account } = await fresh();
    await assignFixtureCase(world.owner, id, reviewer.id);
    await assignFixtureCase(world.owner, id, reviewerB.id);
    await assignFixtureCase(world.owner, id, reviewerB.id);
    expect((await request(reviewer, "reviewer", id)).status).toBe(404);
    expect(
      (
        await request(
          reviewer,
          "reviewer",
          id,
          { revision: 1, status: "in_review" },
          true,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(
          reviewerB,
          "reviewer",
          id,
          { revision: 1, status: "in_review" },
          true,
        )
      ).status,
    ).toBe(409);
    const detail = await readCase(
      world.runtime,
      account.headers,
      id,
      "requester",
    );
    expect(detail.revision).toBe(2);
    expect(detail.history.map((e) => e.action)).toEqual([
      "created",
      "assigned",
      "reassigned",
    ]);
  });
  it("revoked capabilities and removed admin roles deny existing sessions", async () => {
    const staff = await createAccount(world, ["admin"]);
    await authorizeFixtureReviewer(world.owner, staff.id);
    const { id } = await fresh();
    await assignFixtureCase(world.owner, id, staff.id);
    await world.owner.db
      .delete(userRoles)
      .where(eq(userRoles.userId, staff.id));
    expect((await request(staff, "reviewer", id)).status).toBe(403);
    await world.owner.db
      .insert(userRoles)
      .values({ userId: staff.id, role: "admin" });
    await revokeFixtureReviewer(world.owner, staff.id);
    expect((await request(staff, "reviewer", id)).status).toBe(403);
    await expect(
      authorizeFixtureReviewer(world.owner, staff.id),
    ).rejects.toThrow("revoked");
    expect(
      (
        await world.owner.db
          .select()
          .from(supportReviewerEvents)
          .where(eq(supportReviewerEvents.reviewerUserId, staff.id))
      ).map((e) => e.action),
    ).toEqual(["authorized", "revoked"]);
  });
  it("suspended/unverified requesters and reviewers are consistently denied", async () => {
    for (const account of [requester, reviewer]) {
      await world.owner.db
        .update(userAccess)
        .set({ status: "suspended" })
        .where(eq(userAccess.userId, account.id));
      expect((await request(account)).status).toBe(403);
      expect(
        (
          await request(
            account,
            "reviewer",
            caseId,
            { revision: 4, status: "closed" },
            true,
          )
        ).status,
      ).toBe(403);
      await world.owner.db
        .update(userAccess)
        .set({ status: "active" })
        .where(eq(userAccess.userId, account.id));
      await world.owner.db
        .update(user)
        .set({ emailVerified: false })
        .where(eq(user.id, account.id));
      expect((await request(account)).status).toBe(403);
      await world.owner.db
        .update(user)
        .set({ emailVerified: true })
        .where(eq(user.id, account.id));
    }
  });
  it("fixture tooling refuses non-admin/self-review and runtime credentials", async () => {
    await expect(
      authorizeFixtureReviewer(world.owner, requester.id),
    ).rejects.toThrow();
    const own = (await createCase(world.runtime, reviewer.headers, values()))
      .id;
    await expect(
      assignFixtureCase(world.owner, own, reviewer.id),
    ).rejects.toThrow();
    expect((await request(reviewer, "reviewer", own)).status).toBe(404);
    await expect(
      authorizeFixtureReviewer(
        { db: world.runtime.db, pool: world.runtime.pool },
        reviewer.id,
      ),
    ).rejects.toThrow();
    await authorizeFixtureReviewer(world.owner, reviewer.id);
    expect(
      await world.owner.db
        .select()
        .from(supportReviewerEvents)
        .where(eq(supportReviewerEvents.reviewerUserId, reviewer.id)),
    ).toHaveLength(1);
  });
  it("same-key simultaneous retries create one case, reject changed key payload, and preserve one event", async () => {
    const account = await createAccount(world);
    const input = values();
    const rows = await Promise.all([
      createCase(world.runtime, account.headers, input),
      createCase(world.runtime, account.headers, input),
    ]);
    expect(rows[0].id).toBe(rows[1].id);
    expect(
      (
        await request(account, "requester", undefined, {
          ...input,
          subject: "Different",
        })
      ).status,
    ).toBe(409);
    expect(
      await world.owner.db
        .select()
        .from(supportCaseEvents)
        .where(eq(supportCaseEvents.caseId, rows[0].id)),
    ).toHaveLength(1);
  });
  it("serialized concurrent submission bound permits only five new cases", async () => {
    const account = await createAccount(world);
    const rows = await Promise.all(
      Array.from({ length: 6 }, () =>
        request(account, "requester", undefined, values()),
      ),
    );
    expect(rows.map((r) => r.status).sort()).toEqual([
      200, 200, 200, 200, 200, 429,
    ]);
    expect(
      (await listCases(world.runtime, account.headers, "requester")).cases,
    ).toHaveLength(5);
  });
  it("bounds lists and does not include body or unrelated cases in pagination", async () => {
    const account = await createAccount(world);
    await world.owner.db.insert(supportCases).values(
      Array.from({ length: 21 }, () => ({
        ...values(),
        category: "general" as const,
        requesterUserId: account.id,
      })),
    );
    const first = await listCases(world.runtime, account.headers, "requester");
    const second = await listCases(
      world.runtime,
      account.headers,
      "requester",
      2,
    );
    expect(first.cases).toHaveLength(20);
    expect(first.hasMore).toBe(true);
    expect(second.cases).toHaveLength(1);
    expect(second.hasMore).toBe(false);
    expect(
      first.cases.some((a) => second.cases.some((b) => a.id === b.id)),
    ).toBe(false);
  });
  it("audit failure rolls back status and assignment without changing prior records", async () => {
    const { id } = await fresh();
    await assignFixtureCase(world.owner, id, reviewer.id);
    const fn = `support_fail_${randomUUID().replaceAll("-", "")}`;
    await world.owner.pool.query(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.case_id = '${id}'::uuid THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`,
    );
    await world.owner.pool.query(
      `CREATE TRIGGER ${fn} BEFORE INSERT ON support_case_events FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
    );
    try {
      expect(
        (
          await request(
            reviewer,
            "reviewer",
            id,
            { revision: 1, status: "in_review" },
            true,
          )
        ).status,
      ).toBe(503);
      await expect(
        assignFixtureCase(world.owner, id, reviewerB.id),
      ).rejects.toThrow();
      const row = await readCase(
        world.runtime,
        reviewer.headers,
        id,
        "reviewer",
      );
      expect(row.revision).toBe(1);
      expect(row.status).toBe("open");
      expect(row.history).toHaveLength(2);
    } finally {
      await world.owner.pool.query(`DROP TRIGGER ${fn} ON support_case_events`);
      await world.owner.pool.query(`DROP FUNCTION ${fn}()`);
    }
  });
  it("database rejects bad fields, missing owners, invalid/null event shapes and duplicate event revisions", async () => {
    for (const patch of [
      { subject: " " },
      { body: "b".repeat(2001) },
      { category: "unknown" },
      { source: "production" },
      { status: "escalated" },
      { requesterUserId: randomUUID() },
    ])
      await expect(
        world.owner.pool.query(
          "INSERT INTO support_cases (requester_user_id,request_key,category,subject,body,source,status) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [
            patch.requesterUserId ?? requester.id,
            randomUUID(),
            patch.category ?? "general",
            patch.subject ?? "Synthetic",
            patch.body ?? "Synthetic",
            patch.source ?? "local_synthetic",
            patch.status ?? "open",
          ],
        ),
      ).rejects.toThrow();
    await expect(
      world.owner.db.insert(supportCaseEvents).values({
        caseId,
        action: "status_changed",
        actorUserId: reviewer.id,
        revision: 100,
      }),
    ).rejects.toThrow();
    await expect(
      world.owner.db.insert(supportCaseEvents).values({
        caseId,
        action: "created",
        actorUserId: requester.id,
        nextStatus: "open",
        revision: 0,
      }),
    ).rejects.toThrow();
  });
  it("runtime cannot grant/claim assignment, transfer/edit/delete case text, or rewrite audit", async () => {
    for (const query of [
      "INSERT INTO support_reviewers(user_id,source,status) VALUES ($1,'local_fixture','authorized')",
      "UPDATE support_reviewers SET status='authorized' WHERE user_id=$1",
      "INSERT INTO support_reviewer_events(reviewer_user_id,action) VALUES ($1,'authorized')",
    ])
      await expect(
        world.runtime.pool.query(query, [admin.id]),
      ).rejects.toMatchObject({ code: "42501" });
    for (const query of [
      "UPDATE support_case_assignments SET reviewer_user_id='forged' WHERE case_id=$1",
      "INSERT INTO support_case_assignments(case_id,reviewer_user_id) VALUES ($1,'forged')",
      "DELETE FROM support_cases WHERE id=$1",
      "UPDATE support_cases SET requester_user_id='forged' WHERE id=$1",
      "UPDATE support_cases SET body='forged' WHERE id=$1",
      "UPDATE support_cases SET subject='forged' WHERE id=$1",
      "DELETE FROM support_case_events WHERE case_id=$1",
      "UPDATE support_case_events SET action='created' WHERE case_id=$1",
    ])
      await expect(
        world.runtime.pool.query(query, [caseId]),
      ).rejects.toMatchObject({ code: "42501" });
  });
  it("origin/malformed/oversize/local gates deny writes and successful/errors are private no-store", async () => {
    const cross = jsonRequest(world, "/api/support", {
      cookie: requester.cookie,
      body: values(),
      origin: "https://evil.test",
    });
    expect(
      (await handleSupportRequest(world.runtime, cross, "requester")).status,
    ).toBe(403);
    for (const body of [
      "{",
      JSON.stringify({ ...values(), body: "x".repeat(17000) }),
    ]) {
      const req = new Request(`${world.runtime.origin}/api/support`, {
        method: "POST",
        headers: {
          cookie: requester.cookie,
          origin: world.runtime.origin,
          "content-type": "application/json",
        },
        body,
      });
      expect(
        (await handleSupportRequest(world.runtime, req, "requester")).status,
      ).toBe(400);
    }
    expect(
      (
        await handleSupportRequest(
          null,
          jsonRequest(world, "/api/support", { method: "GET" }),
          "requester",
        )
      ).status,
    ).toBe(503);
    await expect(
      listCases(
        { ...world.runtime, environment: "production" as never },
        requester.headers,
        "requester",
      ),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      listCases(
        { ...world.runtime, origin: "https://learli.test" },
        requester.headers,
        "requester",
      ),
    ).rejects.toMatchObject({ status: 503 });
    for (const response of [
      await request(requester, "requester", caseId),
      await request(other, "requester", caseId),
      await request(undefined),
    ]) {
      expect(response.headers.get("cache-control")).toContain(
        "private, no-store",
      );
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    }
  });
});
