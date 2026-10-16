// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));
const client = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { email: client.signIn } },
}));
import { AuthForm } from "@/features/auth/auth-form";

describe("shared auth form document readiness", () => {
  it("server markup has an inert disabled fieldset and POST fallback before scripts in both presentation modes", () => {
    for (const hosted of [false, true]) {
      const container = document.createElement("div");
      container.innerHTML = renderToString(
        <AuthForm mode="sign-in" hosted={hosted} />,
      );
      const form = container.querySelector("form")!;
      expect(form.getAttribute("method")).toBe("post");
      expect(form.getAttribute("action")).toBe("/api/auth/sign-in/email");
      expect(form.querySelector("fieldset")).toHaveAttribute("disabled");
      expect(form.querySelector('input[name="password"]')).toBeDisabled();
      expect(container.textContent).toContain(
        "Enable JavaScript to use account forms here.",
      );
    }
  });
  it("hydrated submission clears credential input before the client request and retains safe failure feedback", async () => {
    client.signIn.mockImplementation(async () => {
      expect(screen.getByLabelText("Password")).toHaveValue("");
      return { error: { code: "synthetic-refusal" } };
    });
    render(<AuthForm mode="sign-in" />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "synthetic@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "synthetic-form-value-only" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Sign in" }).closest("form")!,
    );
    await waitFor(() => expect(client.signIn).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Sign-in could not be completed",
      ),
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "synthetic-form-value-only",
    );
  });
});
