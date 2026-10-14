// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { formatLessonTime } from "@/features/bookings/format-time";
import {
  FamilyDashboard,
  type DashboardData,
} from "@/features/family-dashboard/dashboard";

const refresh = vi.fn();
vi.mock("@/features/family-dashboard/expiry-refresh", () => ({
  ExpiryRefresh: (props: { expiresAt: string | null }) => {
    refresh(props.expiresAt);
    return null;
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/parent",
}));

const checkedAt = formatLessonTime(
  new Date("2026-10-14T00:00:00Z"),
  new Date("2026-10-14T00:00:00Z"),
  "Asia/Manila",
);
const base: DashboardData = {
  workspace: "parent",
  learners: [],
  query: {},
  active: [],
  history: [],
  activeHasNext: true,
  historyHasNext: false,
  checkedAt,
};

describe("family dashboard expiry timer", () => {
  it("uses the server aggregate over all pages", () => {
    refresh.mockClear();
    render(
      <FamilyDashboard
        data={{ ...base, earliestExpiry: "2026-10-14T00:03:00.000Z" }}
      />,
    );
    expect(refresh).toHaveBeenLastCalledWith("2026-10-14T00:03:00.000Z");
  });
  it("schedules nothing when the aggregate is null", () => {
    refresh.mockClear();
    render(<FamilyDashboard data={{ ...base, earliestExpiry: null }} />);
    expect(refresh).toHaveBeenLastCalledWith(null);
  });
});
