import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { readPublicCatalog, readPublicTutor } = vi.hoisted(() => ({
  readPublicCatalog: vi.fn(),
  readPublicTutor: vi.fn(),
}));
vi.mock("@/features/tutors/public", () => ({
  readPublicCatalog,
  readPublicTutor,
}));

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { metadata as authMetadata } from "@/app/(auth)/layout";
import { metadata as workspaceMetadata } from "@/app/(workspace)/layout";
import { metadata as homeMetadata } from "@/app/(marketing)/page";
import { metadata as contactMetadata } from "@/app/(marketing)/contact/page";
import { metadata as concernMetadata } from "@/app/(marketing)/report-a-concern/page";
import { metadata as howItWorksMetadata } from "@/app/(marketing)/how-it-works/page";
import { metadata as becomeATutorMetadata } from "@/app/(marketing)/become-a-tutor/page";
import { generateMetadata as tutorMetadata } from "@/app/(marketing)/tutors/[slug]/page";
import { draftPolicyMetadata } from "@/features/policies/draft-policy-page";
import {
  disallowedPaths,
  indexablePaths,
  robotsRules,
  sitemapEntries,
  websiteStructuredData,
} from "@/lib/seo/crawling";
import {
  noIndex,
  publicPageMetadata,
  shareImage,
  siteDescription,
  siteMetadata,
  tutorPageTitle,
} from "@/lib/seo/metadata";
import { indexingAllowed, siteOrigin } from "@/lib/seo/site";

const origin = new URL("https://tutoring.example");

/** A launched production deployment: the only kind that may be indexed. */
function production(url = origin.href) {
  vi.stubEnv("SEARCH_INDEXING", "open");
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("APP_URL", url);
}

/** Robots matching as crawlers apply it: a prefix, `*` for any run, `$` for the end. */
function blocked(address: string) {
  return disallowedPaths.some((rule) => {
    const anchored = rule.endsWith("$");
    const pattern = (anchored ? rule.slice(0, -1) : rule)
      .split("*")
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${pattern}${anchored ? "$" : ""}`).test(address);
  });
}

function routeFolders(group: string) {
  const directory = fileURLToPath(
    new URL(`../../src/app/${group}`, import.meta.url),
  );
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("["))
    .map((entry) => `/${entry.name}`);
}

beforeEach(() => {
  readPublicCatalog.mockReset();
  readPublicTutor.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("indexing gate", () => {
  it("allows indexing only for launched production on a real HTTPS origin", () => {
    production();
    expect(indexingAllowed()).toBe(true);
  });

  it("keeps production closed until the owner opens indexing", () => {
    for (const value of [
      undefined,
      "",
      "closed",
      "true",
      "1",
      "OPEN",
      " open",
    ]) {
      production();
      vi.stubEnv("SEARCH_INDEXING", value);
      expect(indexingAllowed(), String(value)).toBe(false);
    }
  });

  it("never allows it in development, test or staging", () => {
    vi.stubEnv("SEARCH_INDEXING", "open");
    for (const environment of ["development", "test", "staging"]) {
      vi.stubEnv("APP_ENV", environment);
      vi.stubEnv("APP_URL", origin.href);
      expect(indexingAllowed(), environment).toBe(false);
    }
  });

  it("allows nothing when the environment is not stated or not valid", () => {
    vi.stubEnv("SEARCH_INDEXING", "open");
    vi.stubEnv("APP_URL", origin.href);
    for (const environment of ["", "preview", "Production", " production"]) {
      vi.stubEnv("APP_ENV", environment);
      expect(indexingAllowed(), environment).toBe(false);
    }
  });

  it("refuses production without a real public HTTPS origin", () => {
    for (const url of [
      "",
      "not a url",
      "http://tutoring.example",
      "https://localhost:3000",
      "https://127.0.0.1",
      "https://[::1]",
      "ftp://tutoring.example",
    ]) {
      production(url);
      expect(indexingAllowed(), url).toBe(false);
    }
  });
});

describe("site origin", () => {
  it("comes from APP_URL and keeps only the origin", () => {
    vi.stubEnv("APP_URL", "https://user:secret@tutoring.example/app?x=1#y");
    expect(siteOrigin().href).toBe("https://tutoring.example/");
  });

  it("falls back to the local default when APP_URL is missing or unusable", () => {
    for (const url of ["", "not a url", "ftp://tutoring.example"]) {
      vi.stubEnv("APP_URL", url);
      expect(siteOrigin().href, url).toBe("http://localhost:3000/");
    }
  });
});

describe("site metadata", () => {
  it("excludes every page when the deployment is not indexable", () => {
    const metadata = siteMetadata({ origin, indexable: false });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.metadataBase).toBe(origin);
  });

  it("says nothing about robots when indexing is allowed", () => {
    const metadata = siteMetadata({ origin, indexable: true });
    expect(metadata).not.toHaveProperty("robots");
    expect(metadata.title).toEqual({
      default: "One-to-one online tutoring | Learli",
      template: "%s | Learli",
    });
    expect(metadata.description).toBe(siteDescription);
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      siteName: "Learli",
      images: [shareImage],
    });
    expect(metadata.twitter).toEqual({ card: "summary_large_image" });
  });
});

describe("public page metadata", () => {
  it("gives an indexable page its own title, description and canonical address", () => {
    const metadata = publicPageMetadata({
      title: "How it works",
      description: "A description.",
      path: "/how-it-works",
    });
    expect(metadata).toEqual({
      title: "How it works",
      description: "A description.",
      alternates: { canonical: "/how-it-works" },
      openGraph: {
        type: "website",
        siteName: "Learli",
        images: [shareImage],
        url: "/how-it-works",
      },
    });
  });

  it("never says index, so the environment's exclusion cannot be overridden", () => {
    for (const metadata of [
      homeMetadata,
      howItWorksMetadata,
      becomeATutorMetadata,
      publicPageMetadata({ title: "Any", path: "/tutors/any-tutor" }),
    ])
      expect(metadata).not.toHaveProperty("robots");
  });

  it("keeps an excluded page out of search and gives it no canonical address", () => {
    for (const metadata of [
      contactMetadata,
      concernMetadata,
      draftPolicyMetadata("privacy"),
      draftPolicyMetadata("terms"),
      draftPolicyMetadata("cancellations"),
    ]) {
      expect(metadata.robots).toEqual(noIndex);
      expect(metadata).not.toHaveProperty("alternates");
    }
    expect(draftPolicyMetadata("terms").openGraph).toMatchObject({
      url: "/terms",
    });
  });

  it("leaves the home page on the site title and description", () => {
    expect(homeMetadata).not.toHaveProperty("title");
    expect(homeMetadata.description).toBe(siteDescription);
    expect(homeMetadata.alternates).toEqual({ canonical: "/" });
  });

  it("shares a branded card, never a photograph", () => {
    expect(shareImage.url).toBe("/opengraph-image");
    expect(
      JSON.stringify(siteMetadata({ origin, indexable: true })),
    ).not.toMatch(/\/home\/|\.webp/);
  });

  it("excludes account access and private workspaces at the layout", () => {
    expect(authMetadata.robots).toEqual(noIndex);
    expect(workspaceMetadata.robots).toEqual(noIndex);
  });
});

describe("tutor page title", () => {
  const tutor = (...subjects: string[]) => ({
    displayName: "Ada Example",
    offerings: subjects.map((subjectName) => ({ subjectName })),
  });

  it("names the subjects a tutor lists and nothing else", () => {
    expect(tutorPageTitle(tutor("Math"))).toBe("Ada Example, Math tutor");
    expect(tutorPageTitle(tutor("Math", "Science"))).toBe(
      "Ada Example, Math and Science tutor",
    );
    expect(tutorPageTitle(tutor("English", "Math", "Science"))).toBe(
      "Ada Example, tutor for English, Math and more",
    );
    expect(tutorPageTitle(tutor("Math", "Math"))).toBe(
      "Ada Example, Math tutor",
    );
    expect(tutorPageTitle(tutor())).toBe("Ada Example");
  });
});

describe("tutor profile metadata", () => {
  const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

  it("uses public profile fields and a canonical address without visitor choices", async () => {
    readPublicTutor.mockResolvedValue({
      slug: "ada-example",
      displayName: "Ada Example",
      headline: "Patient help with algebra.",
      bio: "PRIVATE-TO-THE-PAGE-BODY",
      teachingBackground: "PRIVATE-TO-THE-PAGE-BODY",
      teachingLanguages: [],
      offerings: [
        {
          subjectSlug: "math",
          subjectName: "Math",
          levels: ["high_school"],
          specialty: null,
        },
      ],
    });
    const metadata = await tutorMetadata(params("ada-example"));
    expect(metadata).toEqual(
      publicPageMetadata({
        title: "Ada Example, Math tutor",
        description: "Patient help with algebra.",
        path: "/tutors/ada-example",
      }),
    );
    expect(metadata).not.toHaveProperty("robots");
    expect(JSON.stringify(metadata)).not.toContain("PRIVATE");
  });

  it("offers nothing for indexing when the tutor is unknown or the read failed", async () => {
    for (const result of [null, undefined]) {
      readPublicTutor.mockResolvedValue(result);
      expect(await tutorMetadata(params("nobody-here"))).toEqual({
        title: "Tutor",
        robots: noIndex,
      });
    }
  });
});

describe("robots rules", () => {
  it("closes the whole site and names no sitemap when not indexable", () => {
    expect(robotsRules({ origin, indexable: false })).toEqual({
      rules: { userAgent: "*", disallow: "/" },
    });
  });

  it("opens public pages and names the sitemap on the configured origin", () => {
    expect(robotsRules({ origin, indexable: true })).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: [...disallowedPaths] },
      sitemap: "https://tutoring.example/sitemap.xml",
    });
  });

  it("leaves every public page crawlable", () => {
    for (const address of [
      ...indexablePaths,
      "/tutors/ada-example",
      "/tutors?subject=math&level=high_school",
      "/tutors/ada-example?subject=math&displayTimezone=Asia%2FManila",
      "/contact",
      "/report-a-concern",
      "/privacy",
      "/opengraph-image",
      "/sitemap.xml",
    ])
      expect(blocked(address), address).toBe(false);
  });

  it("closes every account-access and workspace route in the app", () => {
    const folders = [...routeFolders("(auth)"), ...routeFolders("(workspace)")];
    expect(folders).toContain("/tutor");
    expect(folders).toContain("/sign-in");
    for (const folder of folders) {
      expect(blocked(folder), folder).toBe(true);
      expect(blocked(`${folder}/anything`), folder).toBe(true);
      expect(indexablePaths, folder).not.toContain(folder);
    }
  });

  it("closes APIs and any address carrying a booking or a token", () => {
    for (const address of [
      "/api/health",
      "/api/tutors/ada-example/availability",
      "/bookings/0f3c",
      "/contact?bookingId=0f3c",
      "/report-a-concern?x=1&bookingId=0f3c",
      "/verify-email?token=abc",
      "/how-it-works?token=abc",
    ])
      expect(blocked(address), address).toBe(true);
  });
});

describe("sitemap", () => {
  it("lists the indexable pages and one address per listed tutor", () => {
    expect(
      sitemapEntries({ origin, tutorSlugs: ["ada-example", "ada-example"] }),
    ).toEqual([
      { url: "https://tutoring.example/" },
      { url: "https://tutoring.example/tutors" },
      { url: "https://tutoring.example/get-matched" },
      { url: "https://tutoring.example/subjects" },
      { url: "https://tutoring.example/how-it-works" },
      { url: "https://tutoring.example/become-a-tutor" },
      { url: "https://tutoring.example/tutors/ada-example" },
    ]);
  });

  it("drops anything that is not a public tutor slug", () => {
    const urls = sitemapEntries({
      origin,
      tutorSlugs: ["../admin", "a b", "Ada", "", "https://evil.example"],
    }).map((entry) => entry.url);
    expect(urls).toHaveLength(indexablePaths.length);
  });

  it("is empty, and reads nothing, where indexing is not allowed", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("APP_URL", origin.href);
    expect(await sitemap()).toEqual([]);
    expect(readPublicCatalog).not.toHaveBeenCalled();
  });

  it("takes tutors from the public directory's own read", async () => {
    production();
    readPublicCatalog.mockResolvedValue({
      tutors: [{ slug: "ada-example" }, { slug: "ben-example" }],
      subjects: [],
    });
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(readPublicCatalog).toHaveBeenCalledOnce();
    expect(urls).toEqual([
      ...indexablePaths.map((path) => new URL(path, origin).href),
      "https://tutoring.example/tutors/ada-example",
      "https://tutoring.example/tutors/ben-example",
    ]);
    for (const url of urls) expect(blocked(new URL(url).pathname)).toBe(false);
  });

  it("still lists the fixed pages when the directory cannot be read", async () => {
    production();
    readPublicCatalog.mockResolvedValue(null);
    expect(await sitemap()).toHaveLength(indexablePaths.length);
  });
});

describe("robots route", () => {
  it("follows the environment it is running in", () => {
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("APP_URL", "http://127.0.0.1:3100");
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    production();
    expect(robots().sitemap).toBe("https://tutoring.example/sitemap.xml");
  });
});

describe("structured data", () => {
  it("describes the website and makes no other claim", () => {
    const data = websiteStructuredData(origin);
    expect(data).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Learli",
      url: "https://tutoring.example/",
      description: siteDescription,
      inLanguage: "en",
    });
    expect(JSON.stringify(data)).not.toMatch(
      /Organization|Review|Rating|Offer|price|address|telephone/i,
    );
  });
});
