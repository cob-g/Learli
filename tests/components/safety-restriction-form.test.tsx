// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SafetyRestrictionForm } from "@/features/safeguarding/restriction-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

beforeEach(() => {
  // jsdom does not implement the modal dialog methods.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function confirmAction() {
  render(
    <SafetyRestrictionForm
      targetId="synthetic-user"
      revision={3}
      status="active"
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Restrict synthetic account" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Confirm access action" }),
  );
}
const alertText = () => screen.findByRole("alert", {}, { timeout: 2000 });

describe("safety restriction form failures", () => {
  it("shows the server-provided message for a JSON error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { message: "This case changed. Reload it." },
            { status: 409 },
          ),
        ),
    );
    await confirmAction();
    await vi.waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "This case changed. Reload it.",
      ),
    );
  });

  it("does not leak a network error to the user", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await confirmAction();
    await vi.waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The change could not be confirmed. Reload the case",
      ),
    );
    expect(await alertText()).not.toHaveTextContent("Failed to fetch");
  });

  it("does not show a SyntaxError for a non-JSON response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("<html>Bad gateway</html>", { status: 502 }),
        ),
    );
    await confirmAction();
    await vi.waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The change could not be confirmed.",
      ),
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      /JSON|Unexpected|token/i,
    );
  });
});
