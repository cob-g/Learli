import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BecomeATutorGuide,
  FindATutorGuide,
  GetMatchedGuide,
  SubjectsGuide,
} from "@/features/home/page-guides";

const guides = {
  "/tutors": renderToStaticMarkup(<FindATutorGuide />),
  "/get-matched": renderToStaticMarkup(<GetMatchedGuide />),
  "/subjects": renderToStaticMarkup(<SubjectsGuide />),
  "/become-a-tutor": renderToStaticMarkup(<BecomeATutorGuide />),
};
/** What a visitor reads: no markup, and no decoration hidden from them. */
const words = (html: string) =>
  html
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<div[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/div>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&apos;/g, "'");

describe("public page guides", () => {
  it.each(Object.entries(guides))(
    "%s adds content without touching the page's working area",
    (_path, html) => {
      // Each page keeps its one page heading, and its forms and status
      // regions stay the only ones on it.
      expect(html).not.toContain("<h1");
      expect(html).not.toContain("<form");
      expect(html).not.toContain("<input");
      expect(html).not.toContain('role="status"');
      expect(html).not.toContain('role="alert"');
      // It is complete without scripts: nothing waits to be revealed.
      expect(html).not.toContain('data-reveal="pending"');
      expect(html.match(/<h2/g)?.length).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(Object.entries(guides))(
    "%s claims nothing the product has not approved",
    (_path, html) => {
      const text = words(html);
      expect(text).not.toMatch(/\d/);
      // Whole words only: "learner" must not trip "earn".
      expect(text).not.toMatch(
        /\b(verified|vetted|guarantee\w*|ratings?|testimonials?|prices?|pricing|paid|pay|earn\w*|commission|discount\w*|free|refund\w*)\b|\$|%/i,
      );
      // Learli is not presented as a school or a classroom.
      expect(text).not.toMatch(/our teachers|our tutors|classroom|curriculum/i);
    },
  );

  it("ends every page on two doors to real public routes", () => {
    const doors = {
      "/tutors": ["/get-matched", "/subjects"],
      "/get-matched": ["/tutors", "/how-it-works"],
      "/subjects": ["/tutors", "/get-matched"],
      "/become-a-tutor": ["/how-it-works", "/contact"],
    };
    for (const [path, hrefs] of Object.entries(doors)) {
      const html = guides[path as keyof typeof guides];
      for (const href of hrefs)
        expect(html, `${path} -> ${href}`).toContain(`href="${href}"`);
      // A page never offers a door to itself.
      expect(html).not.toContain(`href="${path}"`);
    }
  });

  it("numbers only the matching questions, and hides the numerals from assistive technology", () => {
    const numbered = guides["/get-matched"];
    expect(
      numbered.match(
        /aria-hidden="true"><span class="home-tile-number">[1-3]<\/span>/g,
      ),
    ).toHaveLength(3);
    for (const path of ["/tutors", "/subjects", "/become-a-tutor"] as const)
      expect(guides[path]).not.toContain("home-tile-number");
    // The directory's steps use the lesson glyphs instead, in order.
    for (const step of [1, 2, 3])
      expect(guides["/tutors"]).toMatch(
        new RegExp(`class="lesson-glyph" data-state="${step}"`),
      );
  });

  it("keeps every level, College Support included, as a real directory filter", () => {
    for (const level of [
      "elementary",
      "middle_school",
      "high_school",
      "college_support",
    ])
      expect(guides["/subjects"]).toContain(`href="/tutors?level=${level}"`);
    expect(guides["/get-matched"]).toContain("College Support");
  });

  it("uses photographs only where no picture could stand for a listed tutor", () => {
    // The directory and matching are where real tutors appear: no pictures.
    expect(guides["/tutors"]).not.toContain("<img");
    expect(guides["/get-matched"]).not.toContain("<img");
    for (const path of ["/subjects", "/become-a-tutor"] as const) {
      const alts = [...guides[path].matchAll(/<img[^>]*\salt="([^"]*)"/g)].map(
        (match) => match[1],
      );
      expect(alts).toHaveLength(1);
      expect(alts[0].length).toBeGreaterThan(20);
      expect(alts[0]).not.toMatch(/Learli|\bour\b|\breal\b/i);
    }
  });
});
