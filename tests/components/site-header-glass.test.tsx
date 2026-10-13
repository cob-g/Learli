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
  it("uses the same transparent full-width bar on every route", () => {
    for (const pathname of [
      "/",
      "/tutors",
      "/get-matched",
      "/sign-in",
      "/parent",
      "/admin",
    ]) {
      const html = render(pathname);
      expect(html).toContain('class="site-header"');
      expect(html).toContain("site-header-bar glass glass-liquid");
      expect(html).not.toContain("page-shell");
      // Server markup is neither pinned nor raised; scripts add both.
      expect(html).not.toContain("data-live");
      expect(html).not.toContain("data-raised");
    }
  });

  it("keeps every destination and the menu control on every route", () => {
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
