// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { render, screen } from "@testing-library/react";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { AccountForm } from "@/features/account/account-form";
import { listTimeZoneOptions } from "@/lib/time/zones";

describe("account timezone server options", () => {
  it("preserves an existing IANA alias without consulting browser zone data and disables native submission before hydration", () => {
    const account = {
      id: "synthetic-id",
      name: "Synthetic",
      timezone: "Africa/Asmera",
    };
    const timeZones = listTimeZoneOptions(new Date("2026-01-01T00:00:00Z"), [
      account.timezone,
    ]);
    const supported = vi
      .spyOn(Intl, "supportedValuesOf")
      .mockImplementation(() => {
        throw new Error("browser data must not be used");
      });
    try {
      const container = document.createElement("div");
      container.innerHTML = renderToString(
        <AccountForm account={account} timeZones={timeZones} />,
      );
      expect(container.querySelector("fieldset")).toHaveAttribute("disabled");
      expect(container.querySelector("form")).toHaveAttribute("method", "post");
      expect(
        container.querySelector('option[value="Africa/Asmera"]'),
      ).toBeTruthy();
      render(<AccountForm account={account} timeZones={timeZones} />);
      expect(screen.getByLabelText("Time zone")).toHaveValue(account.timezone);
      expect(screen.getByLabelText("Time zone")).toBeEnabled();
      expect(supported).not.toHaveBeenCalled();
    } finally {
      supported.mockRestore();
    }
  });
});
