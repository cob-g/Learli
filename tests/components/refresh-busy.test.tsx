// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusForm } from "@/features/support/status-form";
import { SubjectStateButton } from "@/features/subjects/subject-controls";
import { ScreeningForm } from "@/features/tutor-screening/forms";
import { safePage } from "@/features/support/input";

let release: () => void = () => {};
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockReset();
});

describe("refresh-held busy state", () => {
  it("keeps the status form busy until the refresh transition ends", async () => {
    refresh.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    render(<StatusForm caseId="c1" status="open" revision={0} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Save case status" }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(
      screen.getByRole("button", { name: "Saving status…" }),
    ).toBeVisible();
    await act(async () => release());
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save case status" }),
      ).toBeVisible(),
    );
  });

  it("holds the subject button busy until the refresh lands", async () => {
    refresh.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    render(
      <SubjectStateButton
        subject={{ id: "s1", name: "Math", isActive: true }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Deactivate Math" }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.getByRole("button")).toHaveAttribute("aria-disabled", "true");
    await act(async () => release());
    await waitFor(() =>
      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-disabled",
        "false",
      ),
    );
  });
});

describe("defensive error parsing", () => {
  const detail = {
    state: "pending" as const,
    round: 1,
    revision: 0,
    requiredCodes: ["synthetic_check_a"] as string[],
    checks: [],
  };
  async function submit(body: () => Promise<unknown>) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: body }),
    );
    render(<ScreeningForm tutorId="t1" detail={{ ...detail, checks: [] }} />);
    await userEvent.type(screen.getByLabelText("Evidence reference"), "x");
    await userEvent.type(
      screen.getByLabelText("Checked at (UTC ISO date)"),
      "2026-10-12T12:00:00Z",
    );
    await userEvent.type(
      screen.getByLabelText("Expires at (UTC ISO date)"),
      "2026-10-13T12:00:00Z",
    );
    await userEvent.click(screen.getByRole("button", { name: "Record check" }));
  }
  it("hides parser text for a non-JSON body", async () => {
    await submit(async () => {
      throw new SyntaxError("Unexpected token < is not valid JSON");
    });
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Screening could not be saved.",
      ),
    );
  });
  it("falls back when the message is missing", async () => {
    await submit(async () => ({}));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Screening could not be saved.",
      ),
    );
  });
});

describe("safePage", () => {
  it.each([
    ["abc", 1],
    ["1.5", 1],
    ["0", 1],
    ["-2", 1],
    ["5000", 1],
    ["", 1],
    [undefined, 1],
    ["3", 3],
  ])("%s -> %s", (raw, expected) => {
    expect(safePage(raw)).toBe(expected);
  });
});
