import { describe, expect, it } from "vitest";
import {
  dashboardHref,
  dashboardQuery,
  groupByDate,
  reservationView,
  type ReservationInput,
} from "@/features/family-dashboard/model";

const row: ReservationInput = {
  id: "df51ebd7-ed31-4692-8f18-0d45f33c990b",
  learner: {
    id: "ed274279-a58a-4b26-94ce-724597a5dc24",
    displayName: "Synthetic learner",
    level: "college_support",
  },
  tutorName: "Synthetic tutor",
  subjectName: "Math",
  startAtUtc: "2026-11-01T05:30:00.000Z",
  endAtUtc: "2026-11-01T06:30:00.000Z",
  expiresAt: "2026-10-31T02:10:00.000Z",
  state: "demo_expired",
};

describe("family dashboard presentation", () => {
  it("keeps original instants and both offsets during a repeated DST hour", () => {
    const view = reservationView(row, "America/New_York");
    expect(view.when.time).toContain("GMT-4");
    expect(view.when.time).toContain("GMT-5");
    expect(view.when.date).toContain("November 1, 2026");
    expect(view.durationMinutes).toBe(60);
    expect(view.startAtUtc).toBe(row.startAtUtc);
    expect(view.state).toBe("demo_expired");
    expect(view.expiry.date).toContain("October 30, 2026");
  });
  it("formats viewer date rollover and does not use a learner timezone", () => {
    const view = reservationView(
      {
        ...row,
        startAtUtc: "2026-10-17T15:30:00.000Z",
        endAtUtc: "2026-10-17T16:30:00.000Z",
      },
      "Asia/Manila",
    );
    expect(view.when.date).toContain("October 17, 2026");
    expect(view.when.date).toContain("October 18, 2026");
    expect(view.when.time).toBe("");
    expect(view.when.zone).toContain("GMT+8");
  });
  it("groups already-authorized rows by actual local date without inventing rows", () => {
    const view = reservationView(row, "America/New_York");
    expect(groupByDate([])).toEqual([]);
    expect(
      groupByDate([view, { ...view, id: "another" }])[0].reservations,
    ).toHaveLength(2);
  });
  it.each([
    { learner: "bad" },
    { learner: [row.learner.id, row.learner.id] },
    { historyPage: "0" },
    { activePage: "1.5" },
    { activePage: "10000" },
    { scope: "tutor" },
  ])("rejects forged, repeated and unbounded query input %j", (query) => {
    expect(dashboardQuery.safeParse(query).success).toBe(false);
  });
  it("preserves selected learner and independent pagination in GET links", () => {
    expect(
      dashboardHref(
        "parent",
        { learner: row.learner.id, historyPage: 3 },
        "#history",
      ),
    ).toBe(`/parent?learner=${row.learner.id}&historyPage=3#history`);
    expect(dashboardHref("student", { historyPage: 1 })).toBe("/student");
  });
});
