import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  localAdmissionPolicy,
  validateAdmissionCapability,
} from "@/features/learner-admission/policy";
import {
  localBookingPolicy,
  supportsTutorCompletion,
  validateBookingCapability,
} from "@/features/booking-workflows/policy";
import {
  localScreeningPolicy,
  validateScreeningCapability,
} from "@/features/tutor-screening/policy";
import {
  workflowChange,
  workflowCreate,
} from "@/features/booking-workflows/input";
import { workflowReason } from "@/features/booking-workflows/model";
import { projectBookingRead } from "@/features/bookings/read-projection";
import { changeInput } from "@/features/account-restrictions/input";

describe("ordinary local policy receipts retain their own authority", () => {
  it("binds separate admission and booking identities without changing the local actor rules", () => {
    const admission = validateAdmissionCapability(localAdmissionPolicy);
    const booking = validateBookingCapability(
      localBookingPolicy,
      "development",
    );
    if (admission.authority === "disabled" || booking.authority === "disabled")
      throw new Error();
    expect(admission.source).toBe("local_operation");
    expect(booking.admissionPolicyId).toBe(admission.policyId);
    expect(booking.confirmationActor).toBe("assigned_mfa_admin");
    expect(supportsTutorCompletion(booking)).toBe(true);
    for (const environment of ["test", "staging", "production"])
      expect(() =>
        validateBookingCapability(localBookingPolicy, environment),
      ).toThrow();
    for (const change of [
      { authority: "synthetic_test" },
      { source: "synthetic_readiness" },
      { admissionPolicyId: randomUUID() },
      { confirmationPrerequisite: "paid" },
      { completionActor: "parent" },
    ])
      expect(() =>
        validateBookingCapability(
          { ...localBookingPolicy, ...change },
          "development",
        ),
      ).toThrow();
    expect(() =>
      validateAdmissionCapability({
        ...localAdmissionPolicy,
        guardianProofMethod: "synthetic_guardian_review",
      }),
    ).toThrow();
    expect(() =>
      validateAdmissionCapability({
        ...localAdmissionPolicy,
        contentDigest: "0".repeat(64),
      }),
    ).toThrow();
  });

  it("represents non-expiring local policy separately from expiring check evidence", () => {
    const cap = validateScreeningCapability(
      localScreeningPolicy,
      "development",
    );
    expect(cap).toMatchObject({
      mode: "local_operation",
      validUntil: null,
      expiryRule: "all_checks_current",
    });
    for (const environment of ["test", "staging", "production"])
      expect(() =>
        validateScreeningCapability(localScreeningPolicy, environment),
      ).toThrow();
    expect(() =>
      validateScreeningCapability(
        { ...localScreeningPolicy, validUntil: "2099-01-01T00:00:00Z" },
        "development",
      ),
    ).toThrow();
    expect(() =>
      validateScreeningCapability(
        { ...localScreeningPolicy, requiredCheckCodes: [] },
        "development",
      ),
    ).toThrow();
  });

  it("accepts neutral source-specific actions but never caller-selected booking authority", () => {
    expect(workflowReason("confirm", "local_operation")).toBe(
      "local_prerequisite_review",
    );
    expect(workflowReason("cancel", "synthetic_readiness")).toBe(
      "synthetic_participant_change",
    );
    expect(
      workflowChange.parse({
        requestId: randomUUID(),
        expectedRevision: 1,
        reasonCode: workflowReason("complete", "local_operation"),
      }).reasonCode,
    ).toBe("local_completed");
    const input = {
      learnerId: randomUUID(),
      tutorSlug: "registered-tutor",
      subjectSlug: "math",
      displayTimezone: "Asia/Manila",
      startAtUtc: "2026-11-01T01:00:00Z",
      endAtUtc: "2026-11-01T02:00:00Z",
      idempotencyKey: randomUUID(),
    };
    for (const authority of [
      { source: "local_operation" },
      { role: "admin" },
      { confirmed: true },
      { workflowPolicyId: localBookingPolicy.policyId },
    ])
      expect(workflowCreate.safeParse({ ...input, ...authority }).success).toBe(
        false,
      );
    expect(
      changeInput.safeParse({
        revision: 0,
        status: "active",
        reason: "local_restrict",
        requestKey: randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      changeInput.safeParse({
        revision: 0,
        status: "active",
        reason: "local_restore",
        requestKey: randomUUID(),
      }).success,
    ).toBe(true);
  });

  it("retains confirmed local bookings after their original hold deadline", () => {
    const result = projectBookingRead(
      {
        id: randomUUID(),
        source: "local_operation",
        tutorName: "Registered tutor",
        tutorSlug: "registered-tutor",
        subjectName: "Math",
        subjectSlug: "math",
        learnerId: randomUUID(),
        learnerName: "Private learner",
        learnerLevel: "college_support",
        state: "confirmed",
        start: "2026-11-01T01:00:00Z",
        end: "2026-11-01T02:00:00Z",
        expires: "2026-10-18T00:10:00Z",
        events: [],
      },
      "Asia/Manila",
      new Date("2026-10-18T01:00:00Z"),
    );
    expect(result).toMatchObject({
      source: "local_operation",
      state: "confirmed",
      persistedState: "confirmed",
    });
  });
});
