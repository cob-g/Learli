// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, it, expect, vi } from "vitest";
import { SafeguardingReportForm } from "@/features/safeguarding/forms";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("a refused report remains editable with focused error and no success state", async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ message: "Reporting is unavailable." }),
  });
  vi.stubGlobal("fetch", fetch);
  render(<SafeguardingReportForm />);
  await userEvent.type(screen.getByLabelText("Report subject"), "Fictional");
  await userEvent.type(screen.getByLabelText("Concern"), "Fictional concern");
  await userEvent.click(
    screen.getByRole("button", { name: "Save synthetic report" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Reporting is unavailable.",
    ),
  );
  await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
  expect(screen.getByLabelText("Concern")).toHaveValue("Fictional concern");
  expect(
    screen.getByRole("button", { name: "Save synthetic report" }),
  ).toBeEnabled();
  expect(fetch).toHaveBeenCalledOnce();
});
