import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: null,
      isPending: true,
      isRefetching: false,
      error: null,
      refetch: vi.fn(),
    }),
  },
}));
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

  it("keeps every destination in the bar and in the small-screen dock, with no menu button", () => {
    for (const pathname of ["/", "/tutors"]) {
      const html = render(pathname);
      for (const href of [
        "/tutors",
        "/get-matched",
        "/subjects",
        "/become-a-tutor",
        "/account",
      ])
        expect(html).toContain(`href="${href}"`);
      expect(html).toContain('aria-label="Learli home"');
      // Two navs share the name; styles display exactly one at any width.
      expect(html.match(/aria-label="Main navigation"/g)).toHaveLength(2);
      // The burger and its dialog are gone.
      expect(html).not.toContain("<dialog");
      expect(html).not.toContain("<button");
      expect(html).not.toContain("Mobile navigation");
    }
  });

  it("gives the dock five named tabs and marks the current one", () => {
    const dock = (pathname: string) => {
      const html = render(pathname);
      return html.slice(
        html.indexOf('class="site-dock'),
        html.lastIndexOf("</nav>"),
      );
    };
    const home = dock("/");
    expect(home.match(/<a /g)).toHaveLength(5);
    // Each tab is named by its own words; icons are decoration.
    expect(home.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(5);
    for (const name of ["Home", "Match", "Subjects", "Teach"])
      expect(home).toContain(`<span class="site-dock-label">${name}</span>`);
    expect(home).toContain(
      '<span class="site-dock-label">Find<span class="sr-only"> a tutor</span></span>',
    );
    expect(home).toMatch(
      /href="\/"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/"/,
    );
    expect(home.match(/aria-current=/g)).toHaveLength(1);

    const tutors = dock("/tutors");
    expect(tutors).toMatch(
      /aria-current="page"[^>]*href="\/tutors"|href="\/tutors"[^>]*aria-current="page"/,
    );
    // A page inside a section keeps its section's tab lit, without claiming
    // to be that page.
    const profile = dock("/tutors/some-tutor");
    expect(profile).toMatch(
      /aria-current="true"[^>]*href="\/tutors"|href="\/tutors"[^>]*aria-current="true"/,
    );
    expect(profile).not.toContain('aria-current="page"');
    // Pages outside the five light nothing.
    expect(dock("/sign-in")).not.toContain("aria-current");
  });
});
