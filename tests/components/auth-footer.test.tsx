// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthFooter } from "@/features/auth/auth-footer";
import { SignUpFooter } from "@/features/auth/sign-up-footer";
import { SiteFooter } from "@/components/shared/site-footer";

const route = vi.hoisted(() => ({ pathname: "/sign-up" as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

function footer() {
  return (
    <AuthFooter
      signUpFooter={<SignUpFooter />}
      defaultFooter={<SiteFooter />}
    />
  );
}

describe("auth footer selection", () => {
  it.each(["/sign-up", "/sign-in"])(
    "uses the same compact reference links on %s",
    (pathname) => {
      route.pathname = pathname;
      const view = render(footer());
      expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
      expect(view.container.querySelector(".sign-up-footer")).not.toBeNull();
      expect(view.container.querySelector(".site-footer-accent")).toBeNull();
      expect(screen.getByRole("link", { name: "Learli home" })).toHaveAttribute(
        "href",
        "/",
      );
      for (const [name, href] of [
        ["Privacy draft", "/privacy"],
        ["Terms draft", "/terms"],
        ["Help", "/contact"],
      ])
        expect(screen.getByRole("link", { name })).toHaveAttribute(
          "href",
          href,
        );
      route.pathname = pathname === "/sign-up" ? "/sign-in" : "/sign-up";
      view.rerender(footer());
      expect(view.container.querySelector(".sign-up-footer")).not.toBeNull();
      expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
    },
  );

  it.each([
    "/forgot-password",
    "/reset-password",
    "/sign-up/other",
    "/sign-in/other",
    null,
  ])(
    "preserves the existing footer at %s and switches back after navigation",
    (pathname) => {
      route.pathname = pathname;
      const view = render(footer());
      expect(
        view.container.querySelector(".site-footer-accent"),
      ).not.toBeNull();
      expect(view.container.querySelector(".sign-up-footer")).toBeNull();
      route.pathname = "/sign-up";
      view.rerender(footer());
      expect(view.container.querySelector(".site-footer-accent")).toBeNull();
      expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
      route.pathname = pathname;
      view.rerender(footer());
      expect(
        view.container.querySelector(".site-footer-accent"),
      ).not.toBeNull();
    },
  );
});
