import { describe, it, expect } from "vitest";
import { effectiveDemoState } from "@/features/bookings/lifecycle-model";
import {
  cancelDemoInput,
  rescheduleDemoInput,
} from "@/features/bookings/lifecycle-input";
describe("synthetic lifecycle boundaries", () => {
  it.each(["demo_cancelled", "demo_replaced", "demo_completed"] as const)(
    "keeps terminal %s past deadline",
    (state) =>
      expect(effectiveDemoState(state, new Date(0), new Date(1))).toBe(state),
  );
  it.each(["demo_reserved", "demo_confirmed"] as const)(
    "expires bounded %s",
    (state) =>
      expect(effectiveDemoState(state, new Date(0), new Date(1))).toBe(
        "demo_expired",
      ),
  );
  it("rejects authority/state/expiry fields and malformed changes", () => {
    const base = {
      requestId: "8f05e2f2-b1db-4c94-afac-a1d1e39220e4",
      expectedRevision: 0,
    };
    expect(
      cancelDemoInput.safeParse({ ...base, state: "demo_completed" }).success,
    ).toBe(false);
    expect(
      rescheduleDemoInput.safeParse({
        ...base,
        startAtUtc: "2026-10-14T02:00:00Z",
        endAtUtc: "2026-10-14T01:00:00Z",
        displayTimezone: "UTC",
      }).success,
    ).toBe(false);
  });
});
