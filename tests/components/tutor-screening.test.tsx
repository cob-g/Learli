// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, it, expect, vi } from "vitest";
import { ScreeningForm } from "@/features/tutor-screening/forms";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("keeps a failed check visible and focuses the server denial without approving", async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ message: "Current evidence is required." }),
  });
  vi.stubGlobal("fetch", fetch);
  render(
    <ScreeningForm
      tutorId="00000000-0000-4000-8000-000000000001"
      detail={{
        state: "pending",
        round: 1,
        revision: 0,
        requiredCodes: ["synthetic_check_a"],
        checks: [],
      }}
    />,
  );
  await userEvent.type(
    screen.getByLabelText("Evidence reference"),
    "screening:00000000-0000-4000-8000-000000000001",
  );
  await userEvent.type(
    screen.getByLabelText("Checked at (UTC ISO date)"),
    "2026-10-12T12:00:00Z",
  );
  await userEvent.type(
    screen.getByLabelText("Expires at (UTC ISO date)"),
    "2026-10-13T12:00:00Z",
  );
  await userEvent.click(screen.getByRole("button", { name: "Record check" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Current evidence is required.",
    ),
  );
  await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
  expect(fetch).toHaveBeenCalledOnce();
  expect(screen.getByText("synthetic_check_a: Missing evidence")).toBeVisible();
});
