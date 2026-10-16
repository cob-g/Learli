import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  bookingPolicyDigest,
  validateBookingCapability,
  disabledBooking,
  supportsTutorCompletion,
} from "@/features/booking-workflows/policy";
import {
  workflowCreate,
  workflowChange,
} from "@/features/booking-workflows/input";
import { effectiveDemoState } from "@/features/bookings/lifecycle-model";
const fields = {
  authority: "synthetic_test",
  source: "synthetic_readiness",
  version: "synthetic-booking-v1",
  reference: "synthetic:booking:v1",
  admissionPolicyId: randomUUID(),
  durationMinutes: 60,
  stepMinutes: 30,
  noticeMinutes: 60,
  horizonDays: 14,
  provisionalMinutes: 10,
  cancelCutoffMinutes: 60,
  moveCutoffMinutes: 60,
  confirmationPrerequisite: "synthetic_prerequisite_review",
  confirmationActor: "assigned_mfa_admin",
  outcomeActor: "assigned_mfa_admin",
  disputePath: "/support",
  meetingAccess: "confirmed_until_end",
} as const;
const packet = () => ({
  ...fields,
  policyId: randomUUID(),
  contentDigest: bookingPolicyDigest(fields),
});
describe("explicit synthetic booking policy and unchanged legacy semantics", () => {
  it("retains the exact historical v1 digest and admin completion capability", () => {
    const historical = {
      ...fields,
      admissionPolicyId: "00000000-0000-4000-8000-000000000001",
    };
    expect(bookingPolicyDigest(historical)).toBe(
      "98458fe6a50cc0332a20f524ede999aa9b4c4a7ad350dc7e8ca731c24f4cfe4a",
    );
    const p = validateBookingCapability(packet(), "test");
    if (p.authority === "disabled")
      throw new Error("Expected explicit test capability.");
    expect(supportsTutorCompletion(p)).toBe(false);
  });
  it("binds the assigned tutor completion actor in a separate strict v2 receipt", () => {
    const terms = {
      ...fields,
      version: "synthetic-booking-v2",
      reference: "synthetic:booking:v2",
      completionActor: "assigned_tutor",
    } as const;
    const value = {
      ...terms,
      policyId: randomUUID(),
      contentDigest: bookingPolicyDigest(terms),
    };
    const p = validateBookingCapability(value, "test");
    if (p.authority === "disabled")
      throw new Error("Expected explicit test capability.");
    expect(supportsTutorCompletion(p)).toBe(true);
    expect(p.confirmationActor).toBe("assigned_mfa_admin");
    expect(p.outcomeActor).toBe("assigned_mfa_admin");
    for (const change of [
      { completionActor: "parent" },
      { completionActor: undefined },
      { outcomeActor: "assigned_tutor" },
      { reference: fields.reference },
      { contentDigest: "a".repeat(64) },
    ])
      expect(() =>
        validateBookingCapability({ ...value, ...change }, "test"),
      ).toThrow();
    for (const environment of ["development", "staging", "production"])
      expect(() => validateBookingCapability(value, environment)).toThrow();
    expect(() =>
      validateBookingCapability(
        { ...packet(), completionActor: "assigned_tutor" },
        "test",
      ),
    ).toThrow();
  });
  it("shipped default is disabled in every environment", () => {
    for (const e of ["test", "development", "staging", "production"])
      expect(validateBookingCapability(disabledBooking, e)).toEqual({
        authority: "disabled",
      });
  });
  it("binds every consumed term to a strict digest and rejects extras", () => {
    expect(validateBookingCapability(packet(), "test").authority).toBe(
      "synthetic_test",
    );
    expect(() =>
      validateBookingCapability(
        { ...packet(), admissionPolicyId: randomUUID() },
        "test",
      ),
    ).toThrow();
    expect(() =>
      validateBookingCapability({ ...packet(), paid: true }, "test"),
    ).toThrow();
  });
  it.each(["staging", "production", "development"])(
    "cannot activate synthetic policy in %s",
    (environment) =>
      expect(() => validateBookingCapability(packet(), environment)).toThrow(),
  );
  it.each([
    { authority: "approved" },
    { source: "local_simulation" },
    { provisionalMinutes: 0 },
    { provisionalMinutes: Infinity },
    { confirmationPrerequisite: "paid" },
    { cancelCutoffMinutes: 0 },
    { disputePath: "https://other.test" },
  ])("rejects unapproved or unbounded inputs %j", (change) =>
    expect(() =>
      validateBookingCapability({ ...packet(), ...change }, "test"),
    ).toThrow(),
  );
  it("confirmed never expires from the original provisional deadline while legacy confirmed keeps its old TTL", () => {
    const expires = new Date("2026-10-12T00:00:00Z"),
      now = new Date("2026-10-12T01:00:00Z");
    expect(effectiveDemoState("confirmed", expires, now)).toBe("confirmed");
    expect(effectiveDemoState("provisional", expires, now)).toBe("expired");
    expect(effectiveDemoState("demo_confirmed", expires, now)).toBe(
      "demo_expired",
    );
    expect(effectiveDemoState("demo_reserved", expires, now)).toBe(
      "demo_expired",
    );
  });
  it("strict create never accepts browser confirmed/paid flags or a forged role", () => {
    const v = {
      learnerId: randomUUID(),
      tutorSlug: "fictional-tutor",
      subjectSlug: "math",
      displayTimezone: "Asia/Manila",
      startAtUtc: "2026-10-14T01:00:00Z",
      endAtUtc: "2026-10-14T02:00:00Z",
      idempotencyKey: randomUUID(),
    };
    for (const extra of [
      { confirmed: true },
      { paid: true },
      { role: "admin" },
    ])
      expect(workflowCreate.safeParse({ ...v, ...extra }).success).toBe(false);
  });
  it("outcome reason codes and revisions are bounded server inputs", () => {
    expect(
      workflowChange.safeParse({
        requestId: randomUUID(),
        expectedRevision: 0,
        reasonCode: "attended",
      }).success,
    ).toBe(false);
    expect(
      workflowChange.safeParse({
        requestId: randomUUID(),
        expectedRevision: -1,
        reasonCode: "synthetic_completed",
      }).success,
    ).toBe(false);
  });
});
