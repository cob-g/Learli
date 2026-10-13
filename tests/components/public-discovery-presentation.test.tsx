import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({ catalog: vi.fn() }));
vi.mock("@/features/tutors/public", () => ({
  readPublicCatalog: state.catalog,
  tutorsHref: ({ subject }: { subject: string }) =>
    `/tutors?subject=${subject}`,
}));
import Home from "@/app/(marketing)/page";

beforeEach(() => vi.clearAllMocks());
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
  });
});
