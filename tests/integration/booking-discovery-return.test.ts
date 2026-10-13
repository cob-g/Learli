import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { openWorld, closeWorld, createAccount, type World } from "./support";
import { provisionAdmissionPolicy } from "../support/learner-admission-fixtures";
import {
  createAdmission,
  readMyAdmission,
} from "@/features/learner-admission/service";
import { bookingSelectionHref } from "@/features/bookings/selection";

let world: World;
const discovery = "/bookings/demo?tutorSlug=fictional-tutor&subjectSlug=math";
beforeAll(() => {
  world = openWorld();
});
afterAll(async () => {
  await closeWorld(world);
});

describe("public discovery continuation uses the real admission SQL boundary", () => {
  it("persists the two public fields without creating guardian authority or exposing another applicant", async () => {
    const admission = await provisionAdmissionPolicy(world.owner.pool);
    const requester = await createAccount(
      world,
      [],
      "Fictional discovery requester",
    );
    const unrelated = await createAccount(
      world,
      [],
      "Fictional unrelated discovery requester",
    );
    const context = { runtime: world.runtime, admission };
    const result = await createAdmission(context, requester.headers, {
      management: "guardian",
      displayName: "Fictional discovery learner",
      level: "high_school",
      timezone: "Asia/Manila",
      requestId: randomUUID(),
      policyVersion: admission.version,
      policyDigest: admission.contentDigest,
      next: discovery,
    });
    expect(result.state).toBe("pending");
    expect(result.next).toBe(discovery);
    expect(
      (await readMyAdmission(context, requester.headers, result.id)).next,
    ).toBe(discovery);
    await expect(
      readMyAdmission(context, unrelated.headers, result.id),
    ).rejects.toMatchObject({ status: 404 });
    const links = await world.owner.pool.query<{ n: number }>(
      "SELECT count(*)::int n FROM guardian_learner_links WHERE guardian_user_id=$1",
      [requester.id],
    );
    expect(links.rows[0].n).toBe(0);
  });
  it("keeps legacy complete choices and rejects private, duplicate or malformed SQL selections", async () => {
    const legacy = bookingSelectionHref({
      tutorSlug: "fictional-tutor",
      subjectSlug: "math",
      level: "high_school",
      displayTimezone: "Asia/Manila",
      startAtUtc: "2026-10-21T02:00:00.000Z",
      endAtUtc: "2026-10-21T03:00:00.000Z",
    });
    for (const value of [discovery, legacy]) {
      const result = await world.owner.pool.query<{ valid: boolean }>(
        "SELECT public.valid_admission_selection($1) AS valid",
        [value],
      );
      expect(result.rows[0].valid).toBe(true);
    }
    for (const value of [
      discovery + "&learnerId=private",
      discovery + "&subjectSlug=science",
      discovery + "&next=https://example.com",
      discovery + "&startAtUtc=2026-10-21T02%3A00%3A00.000Z",
      "/bookings/demo?tutorSlug=fictional-tutor",
      "/bookings/demo?tutorSlug=..%2Fadmin&subjectSlug=math",
    ]) {
      const result = await world.owner.pool.query<{ valid: boolean }>(
        "SELECT public.valid_admission_selection($1) AS valid",
        [value],
      );
      expect(result.rows[0].valid).toBe(false);
    }
  });
});
