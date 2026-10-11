// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { formatLessonTime } from "@/features/bookings/format-time";
import {
  TutorBookingAgenda,
  nextTutorSimulation,
  type TutorAgendaBooking,
} from "@/features/tutors/booking-agenda";
import { TutorWorkspaceNavigation } from "@/features/tutors/workspace-navigation";
import { LoadingTutorBookings } from "@/features/tutors/booking-refresh";
import TutorBookingsError from "@/app/(workspace)/tutor/error";
import userEvent from "@testing-library/user-event";

afterEach(cleanup);
const evaluatedAt = "2026-11-01T04:00:00Z";
function booking(
  id: string,
  start = "2026-11-01T05:00:00Z",
  state: TutorAgendaBooking["state"] = "demo_reserved",
): TutorAgendaBooking {
  const end = new Date(new Date(start).getTime() + 3_600_000);
  const expiry = new Date("2026-11-01T04:10:00Z");
  return {
    id,
    detailHref: `/bookings/${id}?scope=tutor`,
    state,
    learnerLabel: "Synthetic learner",
    learnerLevel: "College Support",
    subject: "Math",
    time: formatLessonTime(new Date(start), end, "America/New_York"),
    expiry: formatLessonTime(expiry, expiry, "America/New_York"),
  };
}
function agenda(
  active: TutorAgendaBooking[] = [],
  history: TutorAgendaBooking[] = [],
  more = false,
) {
  return render(
    <TutorBookingAgenda
      active={active}
      history={history}
      evaluatedAt={evaluatedAt}
      hasMoreActive={more}
      hasMoreHistory={more}
    />,
  );
}

describe("tutor simulation presentation", () => {
  it("selects the next future provider-active simulation in deterministic order", () => {
    const next = booking("b");
    expect(
      nextTutorSimulation(
        [
          booking("expired", "2026-11-01T04:30:00Z", "demo_expired"),
          booking("past", "2026-10-31T06:00:00Z"),
          booking("later", "2026-11-01T06:00:00Z"),
          next,
        ],
        evaluatedAt,
      )?.id,
    ).toBe("b");
    expect(
      nextTutorSimulation([booking("b"), booking("a")], evaluatedAt)?.id,
    ).toBe("a");
    expect(
      nextTutorSimulation([booking("now", evaluatedAt)], evaluatedAt),
    ).toBeUndefined();
    expect(nextTutorSimulation([], evaluatedAt)).toBeUndefined();
  });
  it("shows truthful first-use and history empty states with availability action", () => {
    agenda();
    expect(
      screen.getByRole("heading", { name: "No future simulations" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Set availability" }),
    ).toHaveAttribute("href", "/tutor/availability");
    expect(
      screen.getByText("No simulation history on this account."),
    ).toBeVisible();
    expect(screen.queryByText("View booking")).not.toBeInTheDocument();
  });
  it("keeps active, expired and repeated DST-hour records distinct without forbidden actions", () => {
    agenda(
      [booking("next"), booking("second", "2026-11-01T06:00:00Z")],
      [booking("expired", "2026-10-31T05:00:00Z", "demo_expired")],
    );
    expect(
      screen.getByRole("heading", { name: "Next future simulation" }),
    ).toBeVisible();
    expect(
      screen.getByText("This is a local simulation, not a confirmed lesson."),
    ).toBeVisible();
    expect(screen.getAllByText("Simulated reservation")).toHaveLength(2);
    expect(screen.getByText("Simulation expired")).toBeVisible();
    expect(screen.getAllByText("Synthetic learner")).toHaveLength(3);
    expect(screen.getByText(/1:00 AM GMT-4.*1:00 AM GMT-5/)).toBeVisible();
    expect(screen.getByText(/1:00 AM GMT-5.*2:00 AM GMT-5/)).toBeVisible();
    expect(
      screen.getAllByRole("link", {
        name: "View booking for Synthetic learner",
      }),
    ).toHaveLength(3);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /join|meeting|pay|cancel|attend/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Asia\/|America\//)).not.toBeInTheDocument();
  });
  it("renders server expiry date/zone and preserves cross-midnight lesson dates", () => {
    agenda([booking("overnight", "2026-11-02T04:30:00Z")]);
    expect(screen.getByText(/November 1.*November 2/)).toBeVisible();
    expect(screen.getByText("Simulation expires at")).toBeVisible();
    expect(screen.getByText("12:10 AM GMT-4")).toBeVisible();
  });
  it("links bounded previews to provider lists without invented totals", () => {
    agenda(
      [booking("next")],
      [booking("expired", "2026-10-31T05:00:00Z", "demo_expired")],
      true,
    );
    expect(
      screen.getByRole("link", { name: "View all active simulations" }),
    ).toHaveAttribute("href", "/bookings?scope=tutor&filter=active");
    expect(
      screen.getByRole("link", { name: "View all simulation history" }),
    ).toHaveAttribute("href", "/bookings?scope=tutor&filter=history");
  });
  it("escapes minimal learner and subject labels", () => {
    const row = booking("unsafe");
    row.learnerLabel = "<script>privateFixture</script>";
    row.subject = "<img src=x onerror=alert(1)>";
    const { container } = agenda([row]);
    expect(screen.getByText(row.learnerLabel)).toBeVisible();
    expect(container.querySelector("script,img")).toBeNull();
  });
  it("retains all tutor destinations and marks bookings as current", () => {
    render(<TutorWorkspaceNavigation />);
    expect(screen.getByRole("link", { name: "Bookings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const name of [
      "Availability",
      "Time off",
      "Profile",
      "Account settings",
    ])
      expect(screen.getByRole("link", { name })).toBeVisible();
  });
  it("announces loading and provides keyboard-operable retry without private error output", async () => {
    const loading = render(<LoadingTutorBookings />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading your assigned bookings",
    );
    loading.unmount();
    const reset = vi.fn();
    render(<TutorBookingsError reset={reset} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't load your bookings.",
    );
    const button = screen.getByRole("button", { name: "Try again" });
    button.focus();
    await userEvent.setup().keyboard("{Enter}");
    expect(reset).toHaveBeenCalledOnce();
  });
});
