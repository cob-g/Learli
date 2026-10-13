import { describe, expect, it } from "vitest";
import { safeBookingReturnPath } from "@/features/bookings/selection";
import { canonicalAdmissionSelection } from "@/features/learner-admission/input";

const choice = "/bookings/demo?tutorSlug=fictional-tutor&subjectSlug=math";
describe("public tutor and subject survive authentication and admission", () => {
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
