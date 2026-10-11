// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  FamilyDashboard,
  type DashboardData,
} from "@/features/family-dashboard/dashboard";
import { DashboardUnavailable } from "@/features/family-dashboard/states";
import { LessonTime } from "@/features/bookings/lesson-time";
import { reservationView } from "@/features/family-dashboard/model";
import { formatLessonTime } from "@/features/bookings/format-time";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
const learners = [
  {
    id: "ed274279-a58a-4b26-94ce-724597a5dc24",
    displayName: "Synthetic Alex",
    level: "elementary",
  },
  {
    id: "d52e011d-d522-4819-b7a5-89ff2f2b210c",
    displayName: "Synthetic Zoë",
    level: "high_school",
  },
];
const time = formatLessonTime(
  new Date("2026-10-17T07:00:00Z"),
  new Date("2026-10-17T08:00:00Z"),
  "Asia/Manila",
);
const row = reservationView(
  {
    id: "df51ebd7-ed31-4692-8f18-0d45f33c990b",
    learner: learners[0],
    tutorName: "Synthetic tutor",
    subjectName: "Math",
    startAtUtc: time.startAtUtc,
    endAtUtc: time.endAtUtc,
    expiresAt: "2020-01-01T01:10:00Z",
    state: "demo_reserved",
  },
  "Asia/Manila",
);
const data: DashboardData = {
  workspace: "parent",
  learners,
  query: {},
  active: [row],
  history: [],
  activeHasNext: false,
  historyHasNext: false,
  checkedAt: time,
};

describe("family dashboard UI states", () => {
  it("defaults multiple authorized learners to All learners and works as a GET form", () => {
    render(<FamilyDashboard data={data} />);
    expect(screen.getByRole("radio", { name: "All learners" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /Synthetic Alex/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Show bookings" }).closest("form"),
    ).toHaveAttribute("method", "get");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Bookings",
    );
    expect(screen.getByText("For Synthetic Alex")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View booking for/ }),
    ).toHaveAttribute("href", `/bookings/${row.id}?scope=guardian`);
    expect(
      screen.queryByRole("button", { name: /Join|Cancel|Pay/ }),
    ).not.toBeInTheDocument();
  });
  it("names a sole learner and omits the selector", () => {
    render(
      <FamilyDashboard
        data={{
          ...data,
          learners: [learners[0]],
          selectedLearner: learners[0],
        }}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Bookings for Synthetic Alex",
    );
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
  it("uses student detail scope without guardian controls", () => {
    render(
      <FamilyDashboard
        data={{ ...data, workspace: "student", learners: [learners[0]] }}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Your bookings",
    );
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View booking for/ }),
    ).toHaveAttribute("href", `/bookings/${row.id}?scope=student`);
  });
  it("distinguishes no learner, no reservations and load error", () => {
    const empty = render(
      <FamilyDashboard data={{ ...data, learners: [], active: [] }} />,
    );
    expect(
      screen.getByRole("heading", { name: "No authorized learner available" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Reservation history" }),
    ).not.toBeInTheDocument();
    empty.unmount();
    const reserved = render(<FamilyDashboard data={{ ...data, active: [] }} />);
    expect(
      screen.getByText(/No active simulated reservations\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No reservation history yet\./),
    ).toBeInTheDocument();
    reserved.unmount();
    render(<DashboardUnavailable workspace="parent" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "couldn't load bookings",
    );
    expect(screen.queryByText(/No active simulated/)).not.toBeInTheDocument();
  });
  it("renders inactive simulation history and keeps contextual pagination", () => {
    render(
      <FamilyDashboard
        data={{
          ...data,
          active: [],
          selectedLearner: learners[0],
          history: [{ ...row, state: "demo_expired" }],
          historyHasNext: true,
          query: { learner: learners[0].id, historyPage: 2 },
        }}
      />,
    );
    const history = screen.getByRole("region", { name: "Reservation history" });
    expect(within(history).getByText("Simulation expired")).toBeInTheDocument();
    expect(
      within(history).getByRole("link", { name: "Next page" }),
    ).toHaveAttribute(
      "href",
      `/parent?learner=${learners[0].id}&historyPage=3#history`,
    );
  });
  it("labels same-date history separately on opposite sides of a DST offset change", () => {
    const before = reservationView(
      {
        ...row,
        startAtUtc: "2026-11-01T04:00:00.000Z",
        endAtUtc: "2026-11-01T05:00:00.000Z",
        state: "demo_expired",
      },
      "America/New_York",
    );
    const after = reservationView(
      {
        ...row,
        id: "8c7a3a02-0535-45ab-b08a-bc148d79968e",
        startAtUtc: "2026-11-01T07:00:00.000Z",
        endAtUtc: "2026-11-01T08:00:00.000Z",
        state: "demo_expired",
      },
      "America/New_York",
    );
    expect(before.when.date).toBe(after.when.date);
    expect(before.when.zone).toContain("GMT-4");
    expect(after.when.zone).toContain("GMT-5");
    render(
      <FamilyDashboard
        data={{ ...data, active: [], history: [before, after] }}
      />,
    );
    const history = screen.getByRole("region", { name: "Reservation history" });
    const dates = within(history).getAllByRole("heading", {
      level: 3,
      name: before.when.date,
    });
    expect(dates).toHaveLength(2);
    for (const [index, reservation] of [before, after].entries()) {
      const group = within(dates[index].closest("section")!);
      expect(
        group.getByText(`Times shown in ${reservation.when.zone}.`, {
          exact: true,
        }),
      ).toBeInTheDocument();
      expect(group.getByText(reservation.when.time)).toHaveAttribute(
        "datetime",
        reservation.startAtUtc,
      );
      expect(
        group.getAllByRole("link", { name: /View booking for/ }),
      ).toHaveLength(1);
    }
  });
  it("shared LessonTime variants retain UTC markup and explicit full context", () => {
    const full = render(<LessonTime value={time} />);
    expect(screen.getByText(time.zone)).toBeInTheDocument();
    expect(screen.getByText(time.date)).toHaveAttribute(
      "datetime",
      time.startAtUtc,
    );
    full.unmount();
    const prominent = render(<LessonTime value={time} variant="prominent" />);
    expect(screen.getByText(time.date)).toHaveClass("text-section-title");
    prominent.unmount();
    render(<LessonTime value={time} variant="time-only" />);
    expect(screen.getByText(time.time)).toHaveAttribute(
      "datetime",
      time.startAtUtc,
    );
    expect(screen.queryByText(time.zone)).not.toBeInTheDocument();
  });
});
