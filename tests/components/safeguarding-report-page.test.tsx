// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  context: vi.fn(),
  intake: vi.fn(),
  reports: vi.fn(),
}));
const headers = new Headers({ "x-synthetic": "test" });
const runtime = { synthetic: true };
vi.mock("@/lib/permissions/workspace", () => ({
  loadPrivatePage: (
    path: string,
    load: (r: unknown, h: Headers) => Promise<unknown>,
  ) => mocks.load(path, load),
}));
vi.mock("@/features/safeguarding/composition", () => ({
  getSafeguardingContext: () => mocks.context(),
}));
vi.mock("@/features/safeguarding/service", () => ({
  canIntake: () => mocks.intake(),
  listSafeguardingCases: (...args: unknown[]) => mocks.reports(...args),
}));
vi.mock("@/features/safeguarding/forms", () => ({
  SafeguardingReportForm: () => <div>Report form controls</div>,
}));
import Page, {
  dynamic,
  metadata,
} from "@/app/(workspace)/safeguarding/report/page";
const report = {
  id: "22222222-2222-4222-8222-222222222222",
  category: "safety",
  status: "in_review",
  revision: 2,
  acknowledgedAt: null,
  escalationRequestedAt: null,
  reviewer: "Private reviewer name",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.load.mockImplementation(
    async (
      _path: string,
      load: (r: unknown, h: Headers) => Promise<unknown>,
    ) => {
      try {
        return await load(runtime, headers);
      } catch {
        return null;
      }
    },
  );
  mocks.context.mockReturnValue({
    runtime,
    safeguarding: { mode: "synthetic_test" },
  });
  mocks.intake.mockResolvedValue(true);
  mocks.reports.mockResolvedValue([report]);
});
describe("private requester safeguarding report history", () => {
  it("uses the existing exact-requester service and native case link with current status", async () => {
    render(await Page());
    expect(mocks.reports).toHaveBeenCalledWith(
      { runtime, safeguarding: { mode: "synthetic_test" } },
      headers,
      "requester",
    );
    expect(
      screen.getByRole("heading", { name: "Your latest reports" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open report 1" })).toHaveAttribute(
      "href",
      `/safeguarding/cases/${report.id}`,
    );
    expect(screen.getByText(/In review/)).toBeInTheDocument();
    expect(screen.queryByText("Private reviewer name")).not.toBeInTheDocument();
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
  it("keeps existing reports reachable when the intake composition is disabled", async () => {
    mocks.context.mockReturnValue({
      runtime,
      safeguarding: { mode: "disabled" },
    });
    render(await Page());
    expect(mocks.intake).not.toHaveBeenCalled();
    expect(
      screen.getByText(/New safeguarding intake is disabled/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Report form controls")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open report 1" }),
    ).toBeInTheDocument();
  });
  it("distinguishes authorized empty history from read failure", async () => {
    mocks.reports.mockResolvedValue([]);
    render(await Page());
    expect(
      screen.getByText("No currently available reports for this account."),
    ).toBeInTheDocument();
  });
  it("shows history unavailability with a native reload and keeps independently enabled intake", async () => {
    mocks.reports.mockRejectedValue(new Error("Private database diagnostic"));
    render(await Page());
    expect(
      screen.getByText(/Your reports could not be loaded/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Reload reports" }),
    ).toHaveAttribute("href", "/safeguarding/report");
    expect(screen.getByText("Report form controls")).toBeInTheDocument();
    expect(
      screen.queryByText(/No currently available reports/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Private database diagnostic/),
    ).not.toBeInTheDocument();
  });
  it("keeps history available when the independent intake read fails", async () => {
    mocks.intake.mockRejectedValue(new Error("Private intake diagnostic"));
    render(await Page());
    expect(
      screen.getByText(/New report intake is unavailable/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open report 1" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Private intake diagnostic/),
    ).not.toBeInTheDocument();
  });
});
