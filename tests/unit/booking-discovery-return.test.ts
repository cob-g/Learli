import { describe, expect, it } from "vitest";
import {
  safeBookingReturnPath,
  privateBookingHref,
  bookingSelectionHref,
} from "@/features/bookings/selection";
import { canonicalAdmissionSelection } from "@/features/learner-admission/input";

const choice = "/bookings/demo?tutorSlug=fictional-tutor&subjectSlug=math";
describe("public tutor and subject survive authentication and admission", () => {
  it("retains the private booking route through sign-in but preserves the immutable admission selection format", () => {
    const privateChoice = choice.replace("/demo?", "/new?");
    expect(safeBookingReturnPath(privateChoice)).toBe(privateChoice);
    expect(canonicalAdmissionSelection(privateChoice)).toBe(choice);
    expect(
      privateBookingHref(canonicalAdmissionSelection(privateChoice)!),
    ).toBe(privateChoice);
    const selected = bookingSelectionHref(
      {
        tutorSlug: "fictional-tutor",
        subjectSlug: "math",
        level: "middle_school",
        displayTimezone: "Asia/Manila",
        startAtUtc: "2026-10-20T00:00:00.000Z",
        endAtUtc: "2026-10-20T01:00:00.000Z",
      },
      true,
    );
    expect(safeBookingReturnPath(selected)).toBe(selected);
    expect(canonicalAdmissionSelection(selected)).toBe(
      selected.replace("/new?", "/demo?"),
    );
  });
  it("drops private identity, duplicate and external destinations on the private return path", () => {
    for (const suffix of [
      "&learnerId=other-child",
      "&subjectSlug=science",
      "&next=https://elsewhere.example.test",
    ]) {
      const forged = choice.replace("/demo?", "/new?") + suffix;
      expect(safeBookingReturnPath(forged)).toBe("/bookings/new");
      expect(canonicalAdmissionSelection(forged)).toBeNull();
    }
    expect(privateBookingHref("//elsewhere.example.test/bookings/demo")).toBe(
      "/account",
    );
  });
  it("retains the exact public pair without inventing a learner, level or time", () => {
    expect(safeBookingReturnPath(choice)).toBe(choice);
    expect(canonicalAdmissionSelection(choice)).toBe(choice);
  });
  it.each([
    choice + "&learnerId=private-record",
    choice + "&subjectSlug=science",
    choice + "&next=https://example.com",
    choice + "&startAtUtc=2026-10-20T00%3A00%3A00.000Z",
    "/bookings/demo?tutorSlug=fictional-tutor",
    "/bookings/demo?tutorSlug=..%2Fadmin&subjectSlug=math",
  ])(
    "refuses private, duplicate, partial or forged discovery fields: %s",
    (path) => {
      expect(safeBookingReturnPath(path)).toBe("/bookings/demo");
      expect(canonicalAdmissionSelection(path)).toBeNull();
    },
  );
});
