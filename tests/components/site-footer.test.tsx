import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteFooter } from "@/components/shared/site-footer";

const html = renderToStaticMarkup(<SiteFooter />);

describe("site footer", () => {
  it("keeps the same seven destinations, grouped under plain labels", () => {
    const nav = html.slice(
      html.indexOf('<nav aria-label="Footer navigation"'),
      html.indexOf("</nav>"),
    );
    expect(nav.match(/<a /g)).toHaveLength(7);
    for (const [href, label] of [
      ["/how-it-works", "How it works"],
      ["/subjects", "Subjects"],
      ["/contact", "Contact support"],
      ["/report-a-concern", "Report a concern"],
      ["/privacy", "Privacy draft"],
      ["/terms", "Terms draft"],
      ["/cancellations", "Cancellations draft"],
    ])
      expect(nav).toMatch(new RegExp(`href="${href}"[^>]*>${label}</a>`));
    expect(
      [...nav.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((match) => match[1]),
    ).toEqual(["Learli", "Help", "Policies"]);
    // Policies are still published as drafts, and say so.
    expect(nav.match(/ draft<\/a>/g)).toHaveLength(3);
  });

  it("keeps every footer link a full-size target", () => {
    const links = [...html.matchAll(/<a [^>]*class="([^"]*)"/g)].map(
      (match) => match[1],
    );
    expect(links.length).toBeGreaterThanOrEqual(8);
    for (const classes of links) expect(classes).toMatch(/min-h-11|brand-home/);
  });

  it("returns to the top of the page without scripts", () => {
    expect(html).toMatch(/<a href="#main-content"[^>]*>Back to top/);
  });

  it("adds no company, contact or legal details that have not been decided", () => {
    const text = html.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/\d/);
    expect(text).not.toMatch(
      /©|copyright|rights reserved|inc\.|llc|ltd|@|newsletter|subscribe|follow us/i,
    );
  });
});
