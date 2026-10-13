import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  screeningPolicyInput,
  validateScreeningCapability,
} from "@/features/tutor-screening/policy";
import {
  screeningCheckInput,
  screeningDecisionInput,
} from "@/features/tutor-screening/input";
const packet = () => ({
  mode: "synthetic_test" as const,
  provenance: "synthetic_readiness" as const,
  version: "synthetic-v1",
  reference: `policy:${randomUUID()}`,
  authorityReference: `synthetic:${randomUUID()}`,
  validFrom: "2026-10-12T00:00:00Z",
  validUntil: "2026-10-13T00:00:00Z",
  requiredCheckCodes: ["synthetic_check_a", "synthetic_check_b"],
  allowedActions: ["approve", "revoke"] as const,
  expiryRule: "all_checks_current" as const,
});
describe("screening policy authority", () => {
  it("accepts explicitly fictional versioned test packets", () =>
    expect(validateScreeningCapability(packet(), "test").mode).toBe(
      "synthetic_test",
    ));
  it.each(["development", "staging", "production"])(
    "denies synthetic authority in %s",
    (env) => expect(() => validateScreeningCapability(packet(), env)).toThrow(),
  );
  it.each(["test", "production"])(
    "disabled consumes no criteria in %s",
    (env) =>
      expect(validateScreeningCapability({ mode: "disabled" }, env)).toEqual({
        mode: "disabled",
      }),
  );
  it.each([
    { mode: "approved" },
    { provenance: "operational" },
    { requiredCheckCodes: [] },
    { requiredCheckCodes: ["synthetic_a", "synthetic_a"] },
    { requiredCheckCodes: ["actual criteria in prose"] },
    { validUntil: "2026-10-11T00:00:00Z" },
    { validUntil: "infinity" },
    { expiryRule: "none" },
    { allowedActions: ["approve", "approve"] },
  ])("rejects unsupported packet %j", (change) =>
    expect(
      screeningPolicyInput.safeParse({ ...packet(), ...change }).success,
    ).toBe(false),
  );
  it("rejects unknown policy fields", () =>
    expect(
      screeningPolicyInput.safeParse({ ...packet(), guardianConsent: true })
        .success,
    ).toBe(false));
});
describe("strict check and decision requests", () => {
  const check = () => ({
    revision: 0,
    requestKey: randomUUID(),
    code: "synthetic_check_a",
    outcome: "passed",
    reference: `screening:${randomUUID()}`,
    checkedAt: "2026-10-12T00:00:00Z",
    expiresAt: "2026-10-13T00:00:00Z",
  });
  it("accepts a bounded opaque check receipt request", () =>
    expect(screeningCheckInput.safeParse(check()).success).toBe(true));
  it.each([
    { reference: "https://example.test/document" },
    { reference: "screening:../../secret" },
    { checkedAt: "infinity" },
    { expiresAt: "2026-10-11T00:00:00Z" },
    { revision: -1 },
    { revision: 2147483647 },
    { outcome: "verified" },
    { role: "admin" },
    { policyVersion: "forged" },
    { actorId: "forged" },
  ])("rejects unsafe check input %j", (change) =>
    expect(
      screeningCheckInput.safeParse({ ...check(), ...change }).success,
    ).toBe(false),
  );
  it("strictly denies client source/reviewer overrides", () =>
    expect(
      screeningDecisionInput.safeParse({
        action: "approve",
        revision: 0,
        requestKey: randomUUID(),
        source: "operational",
        reviewer: "me",
      }).success,
    ).toBe(false));
});
