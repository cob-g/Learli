// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordForm } from "@/features/account-password/password-form";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  vi.unstubAllGlobals();
  refresh.mockClear();
});
const current = "Current-synthetic-passphrase-123";
const changed = "Changed-synthetic-passphrase-123";
async function fill() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Current password"), current);
  await user.type(
    screen.getByLabelText("New password", { exact: true }),
    changed,
  );
  await user.type(screen.getByLabelText("Confirm new password"), changed);
  return user;
}
describe("password form", () => {
  it("links a focusable three-field summary to inline errors and clears it on corrected submission", async () => {
    const fetch = vi.fn(async () => Response.json({ status: true }));
    vi.stubGlobal("fetch", fetch);
    render(<PasswordForm />);
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("New password", { exact: true }),
      "short",
    );
    await user.type(screen.getByLabelText("Confirm new password"), "different");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    const summary = screen.getByRole("alert", {
      name: "Check these password fields",
    });
    expect(summary).toBeVisible();
    expect(summary).toHaveAttribute("tabindex", "-1");
    await waitFor(() =>
      expect(screen.getByLabelText("Current password")).toHaveFocus(),
    );
    summary.focus();
    expect(summary).toHaveFocus();
    for (const label of [
      "Current password",
      "New password",
      "Confirm new password",
    ]) {
      const field = screen.getByLabelText(label, { exact: true });
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAccessibleDescription();
      const link = within(summary).getByRole("link", {
        name: new RegExp(`^${label}:`),
      });
      expect(link).toHaveAttribute("href", `#${field.id}`);
      link.focus();
      await user.keyboard("{Enter}");
      expect(field).toHaveFocus();
    }
    expect(fetch).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("New password", { exact: true }));
    await user.clear(screen.getByLabelText("Confirm new password"));
    await fill();
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Password changed."),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    for (const label of [
      "Current password",
      "New password",
      "Confirm new password",
    ]) {
      expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute(
        "aria-invalid",
        "false",
      );
      expect(screen.getByLabelText(label, { exact: true })).toHaveValue("");
    }
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("supports password managers and focuses field errors without requesting the server", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<PasswordForm />);
    expect(screen.getByLabelText("Current password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(
      screen.getByLabelText("New password", { exact: true }),
    ).toHaveAttribute("autocomplete", "new-password");
    await userEvent.click(
      screen.getByRole("button", { name: "Change password" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Current password")).toHaveFocus(),
    );
    expect(screen.getByLabelText("Current password")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("shows pending, clears credentials, submits exact fields and focuses safe success", async () => {
    let resolve: (value: Response) => void = () => {};
    const fetch = vi.fn<typeof globalThis.fetch>(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    render(<PasswordForm />);
    const user = await fill();
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Changing your password.",
    );
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Changing password…" }),
    ).toBeDisabled();
    const request = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(Object.keys(request).sort()).toEqual([
      "confirmPassword",
      "currentPassword",
      "newPassword",
    ]);
    resolve(Response.json({ status: true }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Password changed. Other sessions ended.",
      ),
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
    expect(refresh).toHaveBeenCalledOnce();
  });
  it.each([400, 403, 409, 429, 503])(
    "renders safe refusal/recovery for %s, ignoring arbitrary provider text",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({ message: "private provider body" }, { status }),
        ),
      );
      render(<PasswordForm />);
      const user = await fill();
      await user.click(screen.getByRole("button", { name: "Change password" }));
      await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
      expect(
        screen
          .getByRole("alert")
          .textContent?.includes("private provider body"),
      ).toBe(false);
      expect(
        screen.getByRole("link", { name: "Reset password" }),
      ).toHaveAttribute("href", "/forgot-password");
      expect(refresh).not.toHaveBeenCalled();
    },
  );
  it("provides a safe account return path for stale-session reauthentication", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ code: "SESSION_NOT_FRESH" }, { status: 403 }),
      ),
    );
    render(<PasswordForm />);
    const user = await fill();
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Sign out, then sign in again",
      ),
    );
    expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Faccount",
    );
  });
});
