import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  validateSafeguardingCapability,
  safeguardingPolicyInput,
  responseActions,
} from "@/features/safeguarding/policy";
import {
  responseInput,
  safeguardingCaseInput,
  safetyRestrictionInput,
} from "@/features/safeguarding/input";
const policy = () => ({
  mode: "synthetic_test",
  provenance: "synthetic_readiness",
  version: "synthetic-v1",
  reference: `policy:${randomUUID()}`,
  validFrom: "2026-10-12T00:00:00Z",
  validUntil: "2026-10-13T00:00:00Z",
  responsibleOwnerId: "fictional-owner",
  escalationOwnerId: "fictional-escalation-owner",
  reportingGuidanceReference: `synthetic:${randomUUID()}`,
  meetingGuidanceReference: `synthetic:${randomUUID()}`,
  allowedActions: [...responseActions],
  reasonCodes: ["synthetic_safety_restrict", "synthetic_safety_restore"],
});
describe("staffed-response capability gates", () => {
  it("accepts fictional test contract with explicit ownership/guidance", () =>
    expect(validateSafeguardingCapability(policy(), "test").mode).toBe(
      "synthetic_test",
    ));
  it.each(["development", "staging", "production"])(
    "rejects synthetic packet in %s",
    (env) =>
      expect(() => validateSafeguardingCapability(policy(), env)).toThrow(),
  );
  it.each([
    { mode: "operational" },
    { provenance: "local_fixture" },
    { responsibleOwnerId: "" },
    { escalationOwnerId: "fictional-owner" },
    { reportingGuidanceReference: "" },
    { meetingGuidanceReference: "https://example.test" },
    { validUntil: "infinity" },
    { allowedActions: ["automatic_email_response"] },
    { reasonCodes: ["invented_real_safety_standard"] },
  ])("requires bounded complete policy %j", (change) =>
    expect(
      safeguardingPolicyInput.safeParse({ ...policy(), ...change }).success,
    ).toBe(false),
  );
  it("disabled is valid without collecting incident data", () =>
    expect(
      validateSafeguardingCapability({ mode: "disabled" }, "production"),
    ).toEqual({ mode: "disabled" }));
});
describe("response requests do not confer authority", () => {
  it("strictly rejects report ownership/booking overrides", () =>
    expect(
      safeguardingCaseInput.safeParse({
        category: "safety",
        subject: "Fictional",
        body: "Fictional concern",
        requestKey: randomUUID(),
        bookingId: randomUUID(),
        requesterUserId: "forged",
      }).success,
    ).toBe(false));
  it("accepts only bounded response commands", () =>
    expect(
      responseInput.safeParse({
        action: "acknowledge",
        revision: 1,
        requestKey: randomUUID(),
      }).success,
    ).toBe(true));
  it("rejects policy/source assignment overrides", () =>
    expect(
      responseInput.safeParse({
        action: "assign",
        revision: 1,
        requestKey: randomUUID(),
        targetId: "synthetic-target",
        source: "operational",
      }).success,
    ).toBe(false));
  it("cannot choose global or arbitrary restriction reasons", () =>
    expect(
      safetyRestrictionInput.safeParse({
        action: "restrict",
        reason: "because_admin",
        revision: 0,
        requestKey: randomUUID(),
      }).success,
    ).toBe(false));
});
