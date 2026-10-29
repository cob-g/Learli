import { describe, expect, it } from "vitest";
import { independentLearnerInput } from "@/features/independent-learner/input";
import {
  localIndependentAdmissionPolicy,
  validateAdmissionCapability,
} from "@/features/learner-admission/policy";
import {
  localIndependentBookingPolicy,
  validateBookingCapability,
} from "@/features/booking-workflows/policy";

const input = {
  requestId: "ec537f61-bcf7-429a-8589-8d1fe9368128",
  policyVersion: localIndependentAdmissionPolicy.version,
  policyDigest: localIndependentAdmissionPolicy.contentDigest,
  noticeVersion: localIndependentAdmissionPolicy.noticeVersion,
  displayName: "Independent learner",
  timezone: "Asia/Manila",
  eligibilityDeclared: true,
} as const;

describe("independent adult learner contracts", () => {
  it("accepts only an explicit affirmative declaration and canonical fields", () => {
    expect(independentLearnerInput.parse(input)).toEqual(input);
    for (const eligibilityDeclared of [false, undefined])
      expect(
        independentLearnerInput.safeParse({ ...input, eligibilityDeclared })
          .success,
      ).toBe(false);
  });

  it.each(["userId", "role", "source", "state", "learnerId", "level"])(
    "rejects caller-controlled %s authority",
    (field) => {
      expect(
        independentLearnerInput.safeParse({ ...input, [field]: "student" })
          .success,
      ).toBe(false);
    },
  );

  it("normalizes names and rejects unsafe continuation or non-IANA profile values", () => {
    expect(
      independentLearnerInput.parse({ ...input, displayName: " learner " })
        .displayName,
    ).toBe("learner");
    for (const changed of [
      { next: "https://other.invalid/bookings/new" },
      { timezone: "Etc/GMT+8" },
    ])
      expect(
        independentLearnerInput.safeParse({ ...input, ...changed }).success,
      ).toBe(false);
  });

  it("binds immutable independent admission and booking receipts", () => {
    expect(
      validateAdmissionCapability(localIndependentAdmissionPolicy),
    ).toEqual(localIndependentAdmissionPolicy);
    expect(
      validateBookingCapability(localIndependentBookingPolicy, "development"),
    ).toEqual(localIndependentBookingPolicy);
    expect(() =>
      validateAdmissionCapability({
        ...localIndependentAdmissionPolicy,
        noticeVersion: "changed-notice",
      }),
    ).toThrow();
    expect(() =>
      validateBookingCapability(
        {
          ...localIndependentBookingPolicy,
          confirmationActor: "assigned_mfa_admin",
        },
        "development",
      ),
    ).toThrow();
  });
});
