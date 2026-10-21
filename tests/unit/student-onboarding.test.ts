import { describe, expect, it } from "vitest";
import {
  independentAdmissionHref,
  initialAdmissionManagement,
  isStudentOnboardingPath,
  studentAdmissionRequestHref,
  studentContinuation,
  studentOnboardingHref,
} from "@/features/student-onboarding/continuation";
import {
  bookingDiscoveryHref,
  bookingSelectionHref,
} from "@/features/bookings/selection";
import { safeHostedCallback } from "@/features/hosted-auth/callback";

const selection = {
  tutorSlug: "science-college-tutor",
  subjectSlug: "science",
  level: "college_support",
  displayTimezone: "Asia/Manila",
  startAtUtc: "2030-10-16T03:00:00.000Z",
  endAtUtc: "2030-10-16T04:00:00.000Z",
} as const;
describe("College Student intent continuation", () => {
  it.each([false, true])(
    "preserves canonical public tuples and discovery across auth callbacks (private=%s)",
    (privateWorkflow) => {
      for (const next of [
        bookingSelectionHref(selection, privateWorkflow),
        bookingDiscoveryHref(
          {
            tutorSlug: selection.tutorSlug,
            subjectSlug: selection.subjectSlug,
          },
          privateWorkflow,
        ),
      ]) {
        const href = studentOnboardingHref(next);
        expect(isStudentOnboardingPath(href)).toBe(true);
        expect(studentContinuation(href)).toBe(next);
        expect(studentOnboardingHref(href)).toBe(href);
        expect(
          safeHostedCallback(
            `/sign-in?verified=1&${new URLSearchParams({ next: href })}`,
            "https://staging.example.test",
          ),
        ).toBe(true);
        const admission = new URL(
          independentAdmissionHref(href),
          "http://learli.invalid",
        );
        expect(admission.pathname).toBe("/learner-admission/new");
        expect(admission.searchParams.get("management")).toBe("self");
        expect(admission.searchParams.get("next")).toBe(
          next.replace("/bookings/demo", "/bookings/new"),
        );
      }
    },
  );
  it.each([
    undefined,
    null,
    ["/student/onboarding"],
    "/account",
    "/admin",
    "/student",
    "/api/learners",
    "https://unrelated.test",
    "//unrelated.test",
    "/\\unrelated.test",
    "/%2f%2funrelated.test",
    "/student/onboarding?next=%2Fstudent%2Fonboarding",
    "/student/onboarding?next=%2Fbookings%2Fnew&next=%2Fadmin",
    "/student/onboarding?next=https%3A%2F%2Funrelated.test",
    "/student/onboarding?management=self&next=%2Fbookings%2Fnew",
    "/student/onboarding?next=%2Fbookings%2Fnew#fragment",
  ])(
    "normalizes unsafe, recursive or unsupported destinations without granting a workspace: %j",
    (next) => {
      expect(studentContinuation(next)).toBe("/account");
      expect(studentOnboardingHref(next)).toBe("/student/onboarding");
      expect(independentAdmissionHref(next)).toBe(
        "/learner-admission/new?management=self",
      );
    },
  );
  it("drops forged private/duplicate selection fields rather than carrying them into admission", () => {
    const next = bookingSelectionHref(selection, true);
    for (const extra of [
      "&learnerId=foreign",
      "&subjectSlug=math",
      "&role=student",
      "#private",
    ]) {
      expect(studentOnboardingHref(`${next}${extra}`)).toBe(
        "/student/onboarding",
      );
      expect(
        independentAdmissionHref(studentOnboardingHref(`${next}${extra}`)),
      ).not.toContain("next=");
    }
    expect(isStudentOnboardingPath("/student/onboarding-other")).toBe(false);
    expect(isStudentOnboardingPath("/student")).toBe(false);
  });
  it("retains validated private booking scope when rebuilding a booking continuation", () => {
    const next = `${bookingSelectionHref(selection, true)}&scope=student`;
    const href = studentOnboardingHref(next);
    expect(studentContinuation(href)).toBe(next);
    expect(studentOnboardingHref(href)).toBe(href);
    expect(
      safeHostedCallback(
        `/sign-in?verified=1&${new URLSearchParams({ next: href })}`,
        "https://staging.example.test",
      ),
    ).toBe(true);
    expect(studentContinuation("/bookings/new?scope=student")).toBe(
      "/bookings/new?scope=student",
    );
    expect(studentOnboardingHref("/bookings/new?scope=student")).toBe(
      "/student/onboarding?next=%2Fbookings%2Fnew%3Fscope%3Dstudent",
    );
  });
  it("treats only a single exact self query value as the independent form default", () => {
    expect(initialAdmissionManagement("self")).toBe("self");
    for (const value of [
      undefined,
      "guardian",
      "student",
      "SELF",
      ["self"],
      ["self", "guardian"],
      { role: "student" },
    ])
      expect(initialAdmissionManagement(value)).toBe("guardian");
  });
  it("reopens an existing request with only a canonical current public choice", () => {
    const next = bookingSelectionHref(selection, true);
    const href = new URL(
      studentAdmissionRequestHref("own-request", studentOnboardingHref(next)),
      "http://learli.invalid",
    );
    expect(href.pathname).toBe("/learner-admission/own-request");
    expect(href.searchParams.get("next")).toBe(next);
    for (const unsafe of [
      [next, next],
      `${next}&learnerId=foreign`,
      "/admin",
      "https://unrelated.test",
    ])
      expect(studentAdmissionRequestHref("own-request", unsafe)).toBe(
        "/learner-admission/own-request",
      );
  });
});
