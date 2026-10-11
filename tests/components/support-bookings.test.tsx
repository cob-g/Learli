// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { caseInput } from "@/features/support/input";
import {
  BookingSupportAction,
  SupportBookingSection,
} from "@/features/support-bookings/presentation";
import { formatLessonTime } from "@/features/bookings/format-time";

describe("booking support boundary and minimal presentation", () => {
  const bookingId = "11111111-1111-4111-8111-111111111111";
  const base = {
    requestKey: bookingId,
    category: "general",
    subject: "Fictional",
    body: "Synthetic issue",
  };
  it("accepts optional UUID association and rejects malformed/privileged inputs", () => {
    expect(caseInput.parse({ ...base, bookingId }).bookingId).toBe(bookingId);
    expect(caseInput.parse(base)).not.toHaveProperty("bookingId");
    for (const patch of [
      { bookingId: "bad" },
      { bookingId: null },
      { learnerId: bookingId },
      { booking: { id: bookingId } },
    ])
      expect(caseInput.safeParse({ ...base, ...patch }).success).toBe(false);
  });
  it("action carries only booking ID and avoids prefetch", () => {
    render(<BookingSupportAction bookingId={bookingId} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/contact?bookingId=${bookingId}`,
    );
  });
  it("unavailable context discloses no saved booking details", () => {
    render(<SupportBookingSection booking={{ available: false }} />);
    expect(screen.getByText(/Booking context is unavailable/)).toBeVisible();
    expect(screen.queryByText("Tutor")).toBeNull();
  });
  it("renders timezone/date/effective expiry and only actual stored events", () => {
    const time = formatLessonTime(
      new Date("2026-11-01T08:30Z"),
      new Date("2026-11-01T09:30Z"),
      "America/Los_Angeles",
    );
    render(
      <SupportBookingSection
        booking={{
          available: true,
          tutorName: "Synthetic tutor",
          subjectName: "Math",
          time,
          state: "demo_expired",
          events: [],
        }}
      />,
    );
    expect(screen.getByText("Simulation expired")).toBeVisible();
    expect(screen.getByText(time.zone)).toBeVisible();
    expect(screen.getByText("No saved simulation events.")).toBeVisible();
    expect(screen.queryByText("Learner")).toBeNull();
  });
});
