import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
import { SiteHeader } from "@/components/shared/site-header";

beforeEach(() => vi.clearAllMocks());
const render = (pathname: string) => {
  state.pathname = pathname;
  return renderToStaticMarkup(<SiteHeader />);
};

describe("site header glass variant", () => {
  it("is the transparent, full-width glass bar on the public home page only", () => {
    const home = render("/");
    expect(home).toContain('class="home-header"');
    expect(home).toContain("home-header-bar glass glass-liquid");
    // Full viewport width: the bar is not held to the page shell.
    expect(home).not.toContain("page-shell");
    // Server markup is neither pinned nor raised; scripts add both.
    expect(home).not.toContain("data-live");
    expect(home).not.toContain("data-raised");

    for (const pathname of ["/tutors", "/sign-in", "/parent", "/admin"]) {
      const other = render(pathname);
      expect(other).not.toContain("home-header");
      expect(other).not.toContain("glass");
      expect(other).toContain("border-b border-border bg-surface");
      expect(other).toContain("page-shell");
    }
  });

  it("keeps every destination and the menu control in both variants", () => {
    for (const pathname of ["/", "/tutors"]) {
      const html = render(pathname);
      for (const href of [
        "/tutors",
        "/get-matched",
        "/subjects",
        "/become-a-tutor",
        "/sign-in",
      ])
        expect(html).toContain(`href="${href}"`);
      expect(html).toContain('aria-label="Learli home"');
      expect(html).toContain('aria-haspopup="dialog"');
      expect(html).toContain('aria-label="Main navigation"');
      expect(html).toContain('aria-label="Mobile navigation"');
    }
  });
});
