// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminSecurityForm } from "@/features/admin-security/security-form";
vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));
afterEach(() => vi.unstubAllGlobals());
describe("administrator security form", () => {
  it("shows only requested controls without server bootstrap credentials", () => {
    render(<AdminSecurityForm challenge />);
    expect(screen.getByLabelText("Authenticator code")).toHaveAttribute(
      "type",
      "password",
    );
    expect(
      screen.queryByLabelText("Current password for security change"),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use recovery code" }));
    expect(screen.getByLabelText("Recovery code")).toBeInTheDocument();
  });
  it("keeps secret material transient and emits safe focused provider-failure messages", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetch);
    render(<AdminSecurityForm />);
    const password = screen.getByLabelText("Current password");
    fireEvent.change(password, {
      target: { value: "synthetic-secret-password" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Set up authenticator" }),
    );
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
    expect(password).toHaveValue("");
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "synthetic-secret-password",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("makes no request for a malformed authenticator code", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<AdminSecurityForm challenge />);
    fireEvent.change(screen.getByLabelText("Authenticator code"), {
      target: { value: "abc" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Verify administrator access" })
        .closest("form")!,
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter the current authenticator code",
    );
  });
});
