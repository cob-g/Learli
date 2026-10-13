import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({ catalog: vi.fn(), preview: vi.fn() }));
vi.mock("@/features/home/preview-content", () => ({
  previewContentAllowed: state.preview,
}));
vi.mock("@/features/tutors/public", () => ({
  readPublicCatalog: state.catalog,
  tutorsHref: ({ subject, level }: { subject?: string; level?: string }) =>
    subject ? `/tutors?subject=${subject}` : `/tutors?level=${level}`,
}));
import Home from "@/app/(marketing)/page";

beforeEach(() => {
  vi.clearAllMocks();
  // As in production: no preview content unless a test turns it on.
  state.preview.mockReturnValue(false);
});
const render = async () => renderToStaticMarkup(await Home());

describe("public home catalog truth", () => {
  it("reports a failed catalog read as unavailable, without claiming zero inventory", async () => {
    state.catalog.mockResolvedValue(null);
    const html = await render();
    expect(html).toContain("Tutor search is unavailable");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Try again");
    expect(html).not.toContain("No tutors are listed right now");
    expect(html).not.toContain('role="search"');
  });

  it("shows an honest zero-inventory state without a fabricated finder or tutor", async () => {
    state.catalog.mockResolvedValue({ tutors: [], subjects: [] });
    const html = await render();
    expect(html).toContain("No tutors are listed right now");
    expect(html).toContain("Booking is not available yet");
    expect(html).toContain("College Support");
    expect(html).not.toContain('role="search"');
    expect(html).not.toContain("Tutors on Learli");
    expect(html).not.toContain("Tutor search is unavailable");
  });

  it("uses actual catalog offerings for native search and tutor links", async () => {
    state.catalog.mockResolvedValue({
      subjects: [
        { id: "math", slug: "math", name: "Math", category: "academic_core" },
      ],
      tutors: [
        {
          slug: "synthetic-public-test",
          displayName: "Synthetic test tutor",
          bio: "Only a test fixture.",
          teachingLanguages: [],
          offerings: [
            {
              subjectSlug: "math",
              subjectName: "Math",
              levels: ["college_support"],
            },
          ],
        },
      ],
    });
    const html = await render();
    expect(html).toContain('action="/tutors"');
    expect(html).toContain('method="get"');
    expect(html).toContain('name="subject"');
    expect(html).toContain('name="level"');
    expect(html).toContain('href="/tutors/synthetic-public-test"');
    expect(html).toContain('href="/tutors?subject=math"');
    expect(html).toContain("Synthetic test tutor");
    expect(html).not.toContain("No tutors are listed right now");
    // Level links are real directory filters, College Support included.
    expect(html).toContain('href="/tutors?level=college_support"');
  });

  it("keeps Find a tutor, Get matched and Become a tutor reachable in every catalog state", async () => {
    for (const catalog of [null, { tutors: [], subjects: [] }]) {
      state.catalog.mockResolvedValue(catalog);
      const html = await render();
      expect(html).toContain('href="/tutors"');
      expect(html).toContain('href="/get-matched"');
      expect(html).toContain('href="/become-a-tutor"');
      expect(html).toContain('href="/report-a-concern"');
      expect(html).not.toContain("<input");
    }
  });

  it("adds no prices, counts, ratings or verification claims to the page copy", async () => {
    state.catalog.mockResolvedValue({ tutors: [], subjects: [] });
    const text = (await render())
      .replace(/<svg[\s\S]*?<\/svg>/g, " ")
      .replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/\d/);
    expect(text).not.toMatch(
      /verified|vetted|guarantee|rating|review|testimonial|free|price|discount|\$/i,
    );
  });

  it("describes each hero photograph without presenting anyone as a Learli learner or tutor", async () => {
    state.catalog.mockResolvedValue({ tutors: [], subjects: [] });
    const html = await render();
    const alts = [...html.matchAll(/<img[^>]*\salt="([^"]*)"/g)].map(
      (match) => match[1],
    );
    // Five pictures: four in the hero (its room plate is decorative) and the
    // lesson photograph between the two lists.
    expect(alts).toHaveLength(5);
    expect(alts.filter((alt) => alt === "")).toHaveLength(1);
    for (const alt of alts.filter(Boolean)) {
      expect(alt.length).toBeGreaterThan(20);
      expect(alt).not.toMatch(/Learli|\bour\b|\breal\b|student of|tutor/i);
    }
  });

  it("shows no reviews at all where preview content is not allowed", async () => {
    state.catalog.mockResolvedValue({ tutors: [], subjects: [] });
    const html = await render();
    expect(html).not.toContain("home-reviews");
    expect(html).not.toContain("their own words");
    expect(html).not.toContain("<blockquote");
  });

  it("labels the preview's reviews as samples that are not from customers", async () => {
    state.catalog.mockResolvedValue({ tutors: [], subjects: [] });
    state.preview.mockReturnValue(true);
    const html = await render();
    expect(html).toContain("Sample reviews");
    expect(html).toContain("They are not from Learli customers.");
    expect(html.match(/<blockquote/g)).toHaveLength(3);
    // Still exactly one page heading, and the doors still follow.
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html.indexOf("their own words")).toBeLessThan(
      html.indexOf("Looking for a tutor?"),
    );
  });

  it("sets the lesson photograph between what Learli and the tutor each look after", async () => {
    state.catalog.mockResolvedValue({ tutors: [], subjects: [] });
    const html = await render();
    const scene = html.slice(
      html.indexOf('class="home-care"'),
      html.indexOf("Parents and guardians arrange lessons"),
    );
    // Source order is the phone order: picture, Learli's list, the tutor's.
    const order = [
      "home-care-photo",
      "What Learli looks after",
      "What your tutor looks after",
    ].map((part) => scene.indexOf(part));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Learli's list is on glass; the tutor's is a solid navy surface.
    expect(scene).toMatch(
      /class="glass glass-liquid home-care-card home-care-learli/,
    );
    expect(scene).toMatch(
      /class="home-care-card home-care-tutor[^"]*" data-surface="inverse"/,
    );
    expect(scene.match(/<li class="py-4">/g)).toHaveLength(7);
    // The removed day and night comparison stays removed.
    expect(html).not.toContain("home-places");
    expect(html).not.toContain("Where your tutor is");
  });

  it("is complete without scripts: every step is in the markup and nothing is withheld", async () => {
    state.catalog.mockResolvedValue({ tutors: [], subjects: [] });
    const html = await render();
    expect(html).toContain("Find a tutor for your subject");
    expect(html).toContain("Choose an available time");
    expect(html).toContain("Meet on Zoom or Google Meet");
    expect(html).not.toContain('data-reveal="pending"');
    expect(html).not.toContain("data-live");
    // The hero's stroke is decoration: hung twice on one line, with one bead.
    expect(html.match(/class="home-depth-stroke"/g)).toHaveLength(2);
    expect(html.match(/class="home-depth-bead"/g)).toHaveLength(1);
    expect(html).toMatch(
      /class="home-depth-rail home-depth-rail-back" aria-hidden="true"/,
    );
    expect(html).toMatch(/class="home-depth-through[^"]*" aria-hidden="true"/);
    // How a lesson comes together: one decorative stroke with its white stop,
    // three glass tiles on it, each resting on its own finished glyph. Nothing
    // is pinned, filled or drawn beside the steps.
    expect(html.match(/class="home-line" aria-hidden="true"/g)).toHaveLength(1);
    expect(html.match(/class="home-line-bead"/g)).toHaveLength(1);
    expect(html.match(/class="glass glass-liquid home-tile"/g)).toHaveLength(3);
    for (const step of [1, 2, 3])
      expect(html).toMatch(
        new RegExp(`class="lesson-glyph" data-state="${step}" data-reveal=""`),
      );
    expect(html).toContain('data-reveal-group="(min-width: 64rem)"');
    for (const gone of [
      "home-tile-liquid",
      "home-tile-field",
      "data-lesson-stage",
      "data-lesson-steps",
    ])
      expect(html).not.toContain(gone);
    // The page's close is decoration: the stroke, its stop and the wedge that
    // joins the footer, all hidden from assistive technology.
    expect(html).toMatch(
      /class="home-close" data-reveal="" data-scrub="" aria-hidden="true"/,
    );
    for (const part of ["ribbon", "stop", "wedge"])
      expect(
        html.match(new RegExp(`class="home-close-${part}"`, "g")),
      ).toHaveLength(1);
    expect(html.trimEnd().endsWith("</div></div></div>")).toBe(true);
    // Glass is a surface treatment: both refraction filters ship once, and the
    // finder keeps its honest state inside the sheet.
    expect(html.match(/<filter id="learli-glass(-fine)?"/g)).toHaveLength(2);
    expect(html).toMatch(
      /class="glass glass-liquid[^"]*"[^>]*>.*No tutors are listed right now/s,
    );
  });
});
