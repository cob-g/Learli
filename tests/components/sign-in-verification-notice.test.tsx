import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({ AUTH_MODE: "local" }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/features/bookings/pending-choice", () => ({
  PendingBookingChoice: () => null,
}));
vi.mock("@/features/auth/auth-frame", () => ({
  AuthFrame: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/features/auth/auth-form", () => ({ AuthForm: () => null }));

import Page from "@/app/(auth)/sign-in/page";

const html = async (params: Record<string, string>) =>
  renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));

describe("sign-in verification result", () => {
  it("confirms a verified email", async () => {
    const out = await html({ verified: "1" });
    expect(out).toContain('role="status"');
    expect(out).toContain("Email verified. Sign in to continue.");
  });
  it("explains a failed link and points at a new one", async () => {
    const out = await html({ error: "TOKEN_EXPIRED", next: "/tutors" });
    expect(out).toContain('role="alert"');
    expect(out).toContain('href="/verify-email?next=%2Ftutors"');
    expect(out).not.toContain("Email verified");
  });
  it("shows nothing otherwise", async () => {
    const out = await html({});
    expect(out).not.toContain('role="status"');
    expect(out).not.toContain('role="alert"');
  });
});
