import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parentChildInput } from "@/features/parent-children/input";
import {
  localAdmissionPolicy,
  localGuardianAdmissionPolicy,
  validateAdmissionCapability,
} from "@/features/learner-admission/policy";
import {
  localBookingPolicy,
  localParentBookingPolicy,
  validateBookingCapability,
} from "@/features/booking-workflows/policy";

const input = () => ({
  requestId: randomUUID(),
  displayName: "  Private child  ",
  level: "middle_school",
  grade: 8,
  timezone: "Asia/Manila",
  policyVersion: localGuardianAdmissionPolicy.version,
  policyDigest: localGuardianAdmissionPolicy.contentDigest,
  noticeVersion: localGuardianAdmissionPolicy.noticeVersion,
  guardianConfirmed: true,
  consentConfirmed: true,
});

describe("new parent-managed child contract", () => {
  it("normalizes minimum details and preserves optional school grade", () => {
    expect(parentChildInput.parse(input())).toMatchObject({
      displayName: "Private child",
      grade: 8,
    });
    const { grade: _grade, ...withoutGrade } = input();
    expect(_grade).toBe(8);
    expect(parentChildInput.parse(withoutGrade)).not.toHaveProperty("grade");
    expect(
      parentChildInput.parse({ ...input(), grade: null }).grade,
    ).toBeNull();
    expect(
      parentChildInput.safeParse({
        ...input(),
        level: "college_support",
        grade: 8,
      }).success,
    ).toBe(false);
    expect(
      parentChildInput.safeParse({
        ...input(),
        level: "college_support",
        grade: null,
      }).success,
    ).toBe(true);
  });
  it.each(["guardianConfirmed", "consentConfirmed"] as const)(
    "requires actual affirmative %s",
    (field) => {
      for (const value of [undefined, false, "true", 1, null])
        expect(
          parentChildInput.safeParse({ ...input(), [field]: value }).success,
        ).toBe(false);
    },
  );
  it("rejects linking, privilege, state and source injection rather than stripping them", () => {
    for (const field of [
      "learnerId",
      "userId",
      "email",
      "management",
      "role",
      "source",
      "state",
    ])
      expect(
        parentChildInput.safeParse({ ...input(), [field]: randomUUID() })
          .success,
      ).toBe(false);
    for (const grade of [0, 13, 8.5, "8"])
      expect(parentChildInput.safeParse({ ...input(), grade }).success).toBe(
        false,
      );
    for (const next of [
      "https://example.invalid",
      "/parent?learner=secret",
      "/bookings/new?learnerId=" + randomUUID(),
    ])
      expect(parentChildInput.safeParse({ ...input(), next }).success).toBe(
        false,
      );
  });
});

describe("immutable original and new parent policy receipts", () => {
  it("preserves exact v1 bytes and binds separate v2 declaration/booking terms", () => {
    expect(localAdmissionPolicy.contentDigest).toBe(
      "d17fec83537d6ff9840f8b11e5095ca65e4ede81326e67b5ef6d0104e028b402",
    );
    expect(localBookingPolicy.contentDigest).toBe(
      "0a4e0f3b646a7bc5827a2b22ae20cf7f096d131cf85cec8f37ba20363d2e86a7",
    );
    expect(validateAdmissionCapability(localGuardianAdmissionPolicy)).toEqual(
      localGuardianAdmissionPolicy,
    );
    expect(
      validateBookingCapability(localParentBookingPolicy, "development"),
    ).toEqual(localParentBookingPolicy);
    expect(localParentBookingPolicy.confirmationActor).toBe(
      "authorized_parent",
    );
    expect(localParentBookingPolicy.acceptedGuardianPolicyIds).toEqual([
      localAdmissionPolicy.policyId,
      localGuardianAdmissionPolicy.policyId,
    ]);
    expect(localGuardianAdmissionPolicy.contentDigest).toBe(
      "2650ec7f96263a43003cb7b150251aa87fd5adcfe92bc83bf5572fb2f410ae08",
    );
    expect(localParentBookingPolicy.contentDigest).toBe(
      "78a74875f2039d75ac7cac6894c973e70bca9fbe0d09ca2ce669bdd61184ed8b",
    );
  });
  it("rejects changed evidence, confirmation, policy scope and digests", () => {
    for (const patch of [
      { guardianProofMethod: "local_guardian_review" },
      { noticeVersion: "local-notice-v1" },
      { contentDigest: "0".repeat(64) },
    ])
      expect(() =>
        validateAdmissionCapability({
          ...localGuardianAdmissionPolicy,
          ...patch,
        }),
      ).toThrow();
    for (const patch of [
      { confirmationActor: "assigned_mfa_admin" },
      { confirmationPrerequisite: "local_prerequisite_review" },
      {
        acceptedGuardianPolicyIds: [
          randomUUID(),
          localGuardianAdmissionPolicy.policyId,
        ],
      },
      { contentDigest: "0".repeat(64) },
    ])
      expect(() =>
        validateBookingCapability(
          { ...localParentBookingPolicy, ...patch },
          "development",
        ),
      ).toThrow();
    for (const environment of ["test", "staging", "production"])
      expect(() =>
        validateBookingCapability(localParentBookingPolicy, environment),
      ).toThrow();
  });
});
