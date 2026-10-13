import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { openWorld, closeWorld, createAccount } from "./support";
import {
  provisionAdmissionPolicy,
  assignAdmissionReviewer,
} from "../support/learner-admission-fixtures";
import {
  createAdmission,
  listMyAdmissions,
  listAssignedAdmissions,
} from "@/features/learner-admission/service";

describe("bounded private admission keyset traversal", () => {
  it("reaches21 own requests and more than100 assigned requests with exact current scope on every bounded page", async () => {
    const world = openWorld();
    try {
      const admission = await provisionAdmissionPolicy(world.owner.pool),
        context = { runtime: world.runtime, admission };
      const family = await createAccount(world),
        foreign = await createAccount(world),
        staff = await createAccount(world, ["admin"]),
        otherStaff = await createAccount(world, ["admin"]);
      const ownIds: string[] = [],
        allIds: string[] = [];
      async function request(
        actor: Awaited<ReturnType<typeof createAccount>>,
        self = false,
      ) {
        const row = await createAdmission(context, actor.headers, {
          requestId: randomUUID(),
          management: self ? "self" : "guardian",
          displayName: "Fictional keyset request",
          level: self ? "college_support" : "elementary",
          timezone: "UTC",
          policyVersion: admission.version,
          policyDigest: admission.contentDigest,
        });
        allIds.push(row.id);
        await assignAdmissionReviewer(world.owner.pool, row.id, staff.id);
        return row.id;
      }
      for (let i = 0; i < 21; i++) ownIds.push(await request(family, i === 20));
      for (let f = 0; f < 5; f++) {
        const extra = await createAccount(world);
        for (let i = 0; i < 18; i++) await request(extra);
      }
      const first = await listMyAdmissions(context, family.headers);
      expect(first.items).toHaveLength(20);
      expect(first.nextCursor).not.toBeNull();
      const second = await listMyAdmissions(
        context,
        family.headers,
        first.nextCursor,
      );
      expect(second.items).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
      expect(
        new Set([...first.items, ...second.items].map((row) => row.id)),
      ).toEqual(new Set(ownIds));
      expect(JSON.stringify(first.items)).not.toContain(
        "Fictional keyset request",
      );
      await expect(
        listMyAdmissions(context, foreign.headers, first.nextCursor),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        listMyAdmissions(context, family.headers, randomUUID()),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        listMyAdmissions(context, family.headers, "forged"),
      ).rejects.toHaveProperty("issues");
      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const page = await listAssignedAdmissions(
          context,
          staff.headers,
          cursor,
        );
        expect(page.items.length).toBeLessThanOrEqual(20);
        seen.push(...page.items.map((row) => row.id));
        cursor = page.nextCursor;
        pages++;
        expect(pages).toBeLessThan(10);
      } while (cursor);
      expect(pages).toBe(6);
      expect(seen).toHaveLength(111);
      expect(new Set(seen)).toEqual(new Set(allIds));
      await expect(
        listAssignedAdmissions(context, otherStaff.headers, seen[19]),
      ).rejects.toMatchObject({ status: 404 });
    } finally {
      await closeWorld(world);
    }
  }, 60000);
});
