// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";

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
const client = vi.hoisted(() => ({ signup: vi.fn(), verify: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: { email: client.signup },
    sendVerificationEmail: client.verify,
  },
}));
import { AuthForm } from "@/features/auth/auth-form";
import { ParentOnboardingForm } from "@/features/parent-onboarding/form";

beforeEach(() => {
  client.signup.mockReset().mockResolvedValue({ data: {} });
  client.verify.mockReset().mockResolvedValue({ data: {} });
});
afterEach(() => vi.unstubAllGlobals());

function fillSignup() {
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "Parent tester" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "parent@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "Fictional-parent-passphrase" },
  });
}

describe("parent registration intent", () => {
  it("carries Parent through verification without passing trusted role fields to the provider", async () => {
    render(
      <AuthForm
        mode="sign-up"
        next="/tutors?subject=math&level=middle_school"
      />,
    );
    fireEvent.change(screen.getByLabelText("Account type"), {
      target: { value: "parent" },
    });
    fillSignup();
    fireEvent.submit(
      screen.getByRole("button", { name: "Create account" }).closest("form")!,
    );
    await waitFor(() => expect(client.signup).toHaveBeenCalledTimes(1));
    const payload = client.signup.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual([
      "callbackURL",
      "email",
      "name",
      "password",
    ]);
    const callback = new URL(
      payload.callbackURL,
      "https://staging.example.test",
    );
    expect(callback.pathname).toBe("/sign-in");
    const setup = new URL(callback.searchParams.get("next")!, callback.origin);
    expect(setup.pathname).toBe("/parent/onboarding");
    expect(setup.searchParams.get("next")).toBe(
      "/tutors?subject=math&level=middle_school",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Registration request received.",
    );
    expect(
      screen.queryByRole("option", { name: /admin/i }),
    ).not.toBeInTheDocument();
  });
  it("keeps generic registration roleless and returns it to account settings", async () => {
    render(<AuthForm mode="sign-up" />);
    expect(screen.getByLabelText("Account type")).toHaveValue("later");
    fillSignup();
    fireEvent.submit(
      screen.getByRole("button", { name: "Create account" }).closest("form")!,
    );
    await waitFor(() => expect(client.signup).toHaveBeenCalledTimes(1));
    const callback = new URL(
      client.signup.mock.calls[0][0].callbackURL,
      "https://staging.example.test",
    );
    expect(callback.searchParams.get("next")).toBe("/account");
    expect(client.signup.mock.calls[0][0]).not.toHaveProperty("role");
  });
  it("retains parent intent when resending hosted verification", async () => {
    render(<AuthForm mode="verify" hosted next="/parent/onboarding" />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "parent@example.test" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Resend verification" })
        .closest("form")!,
    );
    await waitFor(() => expect(client.verify).toHaveBeenCalledTimes(1));
    const callback = new URL(
      client.verify.mock.calls[0][0].callbackURL,
      "https://staging.example.test",
    );
    expect(callback.searchParams.get("next")).toBe("/parent/onboarding");
    expect(screen.getByRole("status")).toHaveTextContent(
      "delivery has not been established",
    );
  });
});

describe("explicit parent workspace enrollment", () => {
  it("cannot submit the native server document before scripts are ready", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<ParentOnboardingForm />);
    expect(container.querySelector("form")).toHaveAttribute("method", "post");
    expect(container.querySelector("button")).toBeDisabled();
    expect(container.textContent).toContain("Enable JavaScript");
  });
  it("prevents duplicate pending requests and allows a safe retry after an uncertain failure", async () => {
    let finish!: (response: Response) => void;
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error("Synthetic network failure"));
    vi.stubGlobal("fetch", fetch);
    render(<ParentOnboardingForm />);
    const button = screen.getByRole("button", { name: "Continue as parent" });
    const form = button.closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/account/parent-onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(button).toBeDisabled();
    finish(Response.json({ message: "unavailable" }, { status: 503 }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "repeated request will not duplicate",
      ),
    );
    expect(button).toBeEnabled();
    fireEvent.submit(form);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "We could not confirm parent setup",
      ),
    );
    expect(button).toBeEnabled();
  });
});
