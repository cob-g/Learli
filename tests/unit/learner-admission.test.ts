import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  admissionInput,
  canonicalAdmissionSelection,
  evidenceInput,
  reviewInput,
} from "@/features/learner-admission/input";
import { validateAdmissionCapability } from "@/features/learner-admission/policy";
import { syntheticAdmissionPolicy } from "../support/learner-admission-fixtures";
import { bookingSelectionHref } from "@/features/bookings/selection";
const choice = {
  tutorSlug: "synthetic-tutor",
  subjectSlug: "math",
  level: "elementary" as const,
  displayTimezone: "Asia/Manila",
  startAtUtc: "2026-10-20T08:00:00Z",
  endAtUtc: "2026-10-20T09:00:00Z",
};
const policy = syntheticAdmissionPolicy(randomUUID());
const intake = {
  management: "guardian",
  displayName: "Fictional learner",
  level: "elementary",
  timezone: "UTC",
  requestId: randomUUID(),
  policyVersion: policy.version,
  policyDigest: policy.contentDigest,
};
describe("admission strict consumed policy and public continuation", () => {
  it("defaults only to strict disabled and validates exact immutable synthetic digest", () => {
    expect(validateAdmissionCapability({ authority: "disabled" })).toEqual({
      authority: "disabled",
    });
    expect(validateAdmissionCapability(policy)).toEqual(policy);
    expect(() =>
      validateAdmissionCapability({ ...policy, contentDigest: "0".repeat(64) }),
    ).toThrow();
  });
  it.each([
    { ...policy, authority: "approved" },
    { ...policy, source: "operational" },
    { ...policy, consent: true },
    { ...policy, guardianProofMethod: "email" },
    { authority: "disabled", child: "private" },
  ])("rejects forged/unknown policy fields", (input) =>
    expect(() => validateAdmissionCapability(input)).toThrow(),
  );
  it("keeps exact original public time after canonicalization and refresh", () => {
    const href = bookingSelectionHref(choice);
    expect(canonicalAdmissionSelection(href)).toBe(href);
    expect(canonicalAdmissionSelection(canonicalAdmissionSelection(href))).toBe(
      href,
    );
  });
  it.each([
    "https://foreign.test/child",
    "//foreign.test",
    "/learners/private",
    "/bookings/private",
    "/bookings/demo?learnerId=private",
    bookingSelectionHref(choice) + "&role=parent",
    bookingSelectionHref(choice) + "&tutorSlug=other",
    bookingSelectionHref(choice) + "#private",
    undefined,
    [],
  ])("discards malformed/external/private/duplicate next", (next) =>
    expect(canonicalAdmissionSelection(next)).toBeNull(),
  );
  it("independent path uses College without arbitrary roles", () => {
    expect(
      admissionInput.parse({
        ...intake,
        management: "self",
        level: "college_support",
      }).management,
    ).toBe("self");
    expect(() =>
      admissionInput.parse({ ...intake, management: "self" }),
    ).toThrow();
  });
  it.each([
    { role: "admin" },
    { state: "authorized" },
    { guardianUserId: "forged" },
    { learnerId: randomUUID() },
    { source: "local_fixture" },
    { evidenceId: randomUUID() },
  ])("rejects privilege and relationship fields", (extra) =>
    expect(() => admissionInput.parse({ ...intake, ...extra })).toThrow(),
  );
  it.each([
    "https://document.test",
    "name@example.test",
    "token with personal spaces",
    "a".repeat(129),
  ])("rejects URL/contact/free text evidence", (reference) =>
    expect(() =>
      evidenceInput.parse({
        requestId: randomUUID(),
        revision: 0,
        checkCode: "guardian_authority",
        reference,
      }),
    ).toThrow(),
  );
  it("requires explicit revision and permitted state action", () => {
    expect(() =>
      reviewInput.parse({ requestId: randomUUID(), action: "authorize" }),
    ).toThrow();
    expect(() =>
      reviewInput.parse({
        requestId: randomUUID(),
        revision: 0,
        action: "reopen",
      }),
    ).toThrow();
  });
});

describe("strict opaque admission cursors", () => {
  it("accepts no personal fields or malformed/duplicate cursor", async () => {
    const { admissionListCursor } =
      await import("@/features/learner-admission/input");
    expect(admissionListCursor(undefined)).toBeNull();
    expect(admissionListCursor(randomUUID())).toEqual(expect.any(String));
    for (const value of [
      "",
      1,
      ["one", "two"],
      "person@example.test",
      "2026-10-12",
      "https://foreign.test",
    ])
      expect(() => admissionListCursor(value)).toThrow();
  });
});

describe("private admission school-grade metadata", () => {
  it("keeps the optional grade separate from the reviewed broad level", () => {
    const request = admissionInput.parse({ ...intake, grade: 8 });
    expect(request).toMatchObject({ grade: 8, level: "elementary" });
    expect(admissionInput.parse(intake)).not.toHaveProperty("grade");
    expect(admissionInput.parse({ ...intake, grade: null }).grade).toBeNull();
  });
  it.each([0, 13, 2.5, "8", false])("rejects invalid grade %j", (grade) => {
    expect(admissionInput.safeParse({ ...intake, grade }).success).toBe(false);
  });
  it("does not assign school grades to independent College profiles", () => {
    expect(
      admissionInput.safeParse({
        ...intake,
        management: "self",
        level: "college_support",
        grade: 8,
      }).success,
    ).toBe(false);
  });
  it("permits grade edit/clear/omission without allowing a reviewed level change", async () => {
    const { admittedLearnerInput } =
      await import("@/features/learner-admission/input");
    const edit = { displayName: "Fictional learner", timezone: "UTC" };
    expect(admittedLearnerInput.parse(edit)).not.toHaveProperty("grade");
    expect(admittedLearnerInput.parse({ ...edit, grade: 8 }).grade).toBe(8);
    expect(
      admittedLearnerInput.parse({ ...edit, grade: null }).grade,
    ).toBeNull();
    expect(
      admittedLearnerInput.safeParse({ ...edit, level: "high_school" }).success,
    ).toBe(false);
  });
});
