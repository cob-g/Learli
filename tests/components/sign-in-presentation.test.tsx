// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const roots: Root[] = [];
beforeEach(() => {
  client.signIn.mockReset();
});
afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document
    .querySelectorAll("[data-sign-in-hydration-test]")
    .forEach((node) => node.remove());
});

describe("reference sign-in presentation", () => {
  it("keeps password visibility inert in server markup and enables the same controls after hydration", async () => {
    const node = <AuthForm mode="sign-in" presentation="reference" />;
    const container = document.createElement("div");
    container.setAttribute("data-sign-in-hydration-test", "");
    container.innerHTML = renderToString(node);
    document.body.append(container);
    const password = within(container).getByLabelText("Password");
    const toggle = within(container).getByRole("button", {
      name: "Show password",
    });
    const form = container.querySelector("form")!;
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/api/auth/sign-in/email");
    expect(password).toBeDisabled();
    expect(password).toHaveAttribute("type", "password");
    expect(toggle).toBeDisabled();
    expect(toggle.closest("fieldset")).toBe(password.closest("fieldset"));

    const onRecoverableError = vi.fn();
    await act(async () => {
      roots.push(hydrateRoot(container, node, { onRecoverableError }));
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(within(container).getByLabelText("Password")).toBe(password);
    expect(
      within(container).getByRole("button", { name: "Show password" }),
    ).toBe(toggle);
    expect(password).toBeEnabled();
    expect(toggle).toBeEnabled();
    fireEvent.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(toggle).toHaveAccessibleName("Hide password");
  });

  it("toggles only password visibility while retaining the credential field and recovery link semantics", () => {
    render(<AuthForm mode="sign-in" presentation="reference" />);
    const password = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    const credential = "Fictional-visibility-passphrase";
    fireEvent.change(password, { target: { value: credential } });

    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAttribute("aria-controls", password.id);
    expect(password).toHaveAttribute("name", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(password).toHaveAttribute("type", "password");

    fireEvent.click(toggle);

    expect(toggle).toHaveAccessibleName("Hide password");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Password")).toBe(password);
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue(credential);
    expect(password).toHaveAttribute("name", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");

    fireEvent.click(toggle);

    expect(toggle).toHaveAccessibleName("Show password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveValue(credential);
    expect(client.signIn).not.toHaveBeenCalled();
    const recovery = screen.getByRole("link", { name: "Forgot password?" });
    expect(recovery).toHaveAttribute("href", "/forgot-password");
    expect(
      password.compareDocumentPosition(recovery) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("masks and clears a revealed credential before requesting sign-in, disables pending controls and focuses safe failure feedback", async () => {
    let finishSignIn!: (result: {
      error: { code: string; message: string };
    }) => void;
    const response = new Promise<{ error: { code: string; message: string } }>(
      (resolve) => {
        finishSignIn = resolve;
      },
    );
    client.signIn.mockImplementation(() => {
      expect(screen.getByLabelText("Password")).toHaveAttribute(
        "type",
        "password",
      );
      expect(screen.getByLabelText("Password")).toHaveValue("");
      return response;
    });
    render(<AuthForm mode="sign-in" presentation="reference" />);
    const password = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    const submit = screen.getByRole("button", { name: "Sign in" });
    const form = submit.closest("form")!;
    const email = "visibility@example.test";
    const credential = "Fictional-pending-passphrase";
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: email },
    });
    fireEvent.change(password, { target: { value: credential } });
    fireEvent.click(toggle);
    expect(password).toHaveAttribute("type", "text");

    fireEvent.submit(form);

    expect(client.signIn).toHaveBeenCalledExactlyOnceWith({
      email,
      password: credential,
    });
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(password).toHaveValue("");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toBeDisabled();
    expect(toggle).toHaveAccessibleName("Show password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toBeDisabled();
    expect(submit).toBeDisabled();
    expect(submit).toHaveTextContent("Please wait");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await act(async () => {
      finishSignIn({
        error: {
          code: "synthetic-refusal",
          message: "Provider detail must remain private",
        },
      });
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Sign-in could not be completed. Check your details and verify your email.",
    );
    expect(alert).not.toHaveTextContent(credential);
    expect(alert).not.toHaveTextContent("Provider detail must remain private");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(form).toHaveAttribute("aria-busy", "false");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveValue("");
    expect(toggle).toHaveAccessibleName("Show password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toBeEnabled();
    expect(submit).toBeEnabled();
  });

  it("leaves the default sign-in presentation without a password visibility control", () => {
    render(<AuthForm mode="sign-in" />);
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(
      screen.queryByRole("button", { name: /show password|hide password/i }),
    ).not.toBeInTheDocument();
  });

  it.each(["sign-up", "forgot", "reset", "verify"] as const)(
    "does not add password visibility controls to %s mode",
    (mode) => {
      render(
        <AuthForm
          mode={mode}
          presentation="reference"
          token="synthetic-reset-token"
        />,
      );
      expect(
        screen.queryByRole("button", { name: /show password|hide password/i }),
      ).not.toBeInTheDocument();
    },
  );
});
