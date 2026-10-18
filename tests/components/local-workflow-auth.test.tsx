// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const client = vi.hoisted(() => ({
  signup: vi.fn(),
  verify: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: { email: client.signup },
    sendVerificationEmail: client.verify,
    requestPasswordReset: client.reset,
  },
}));
import { AuthForm } from "@/features/auth/auth-form";
import { EmailForm } from "@/features/account-email/email-form";
beforeEach(() => {
  vi.clearAllMocks();
  client.signup.mockResolvedValue({ data: {} });
  client.verify.mockResolvedValue({ data: {} });
  client.reset.mockResolvedValue({ data: {} });
});

describe("ordinary local account guidance", () => {
  it("accepts normal signup, preserves Parent intent and explains the actual captured-mail next step", async () => {
    render(<AuthForm mode="sign-up" localWorkflow next="/parent/onboarding" />);
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Local parent" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "parent@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "unit-only-passphrase" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Create account" }).closest("form")!,
    );
    await waitFor(() => expect(client.signup).toHaveBeenCalledTimes(1));
    expect(client.signup.mock.calls[0][0]).toEqual({
      name: "Local parent",
      email: "parent@example.com",
      password: "unit-only-passphrase",
      callbackURL: "/sign-in?verified=1&next=%2Fparent%2Fonboarding",
    });
    expect(
      screen.getByRole("heading", { name: "Verify your email" }),
    ).toBeVisible();
    expect(screen.getByText(/Run npm run mail:open/)).toHaveTextContent(
      "No email was sent.",
    );
    expect(
      screen.queryByText(/ending in \.test|local test mailbox|test messages/),
    ).not.toBeInTheDocument();
  });

  it.each(["forgot", "verify"] as const)(
    "accepts normal %s request and gives a non-enumerating capture instruction",
    async (mode) => {
      render(<AuthForm mode={mode} localWorkflow />);
      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "person@example.com" },
      });
      fireEvent.submit(
        screen
          .getByRole("button", {
            name:
              mode === "forgot" ? "Request reset link" : "Resend verification",
          })
          .closest("form")!,
      );
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "npm run mail:open",
        ),
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "No email was sent.",
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        mode === "forgot"
          ? "If an account matches"
          : "If verification is needed",
      );
    },
  );

  it("retains synthetic-only signup by default", async () => {
    render(<AuthForm mode="sign-up" />);
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Default preview" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "unit-only-passphrase" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Create account" }).closest("form")!,
    );
    expect(client.signup).not.toHaveBeenCalled();
    expect(
      screen.getByText(/This preview only accepts addresses ending in \.test/),
    ).toBeVisible();
  });

  it("normal email changes reach the current-proof stage without a synthetic-only label", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ status: true, stage: "current" }));
    try {
      render(<EmailForm currentEmail="current@example.com" localWorkflow />);
      fireEvent.submit(
        screen
          .getByRole("button", { name: "Send current-address code" })
          .closest("form")!,
      );
      await waitFor(() =>
        expect(screen.getByLabelText("New email")).toBeVisible(),
      );
      fireEvent.change(screen.getByLabelText("New email"), {
        target: { value: "new@example.com" },
      });
      fireEvent.change(screen.getByLabelText("Current-address code"), {
        target: { value: "123456" },
      });
      fireEvent.submit(
        screen
          .getByRole("button", { name: "Confirm current address" })
          .closest("form")!,
      );
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      expect(JSON.parse(fetch.mock.calls[1][1]?.body as string)).toEqual({
        action: "request",
        newEmail: "new@example.com",
        code: "123456",
      });
      expect(screen.queryByText(/synthetic \.test/)).not.toBeInTheDocument();
    } finally {
      fetch.mockRestore();
    }
  });
});
