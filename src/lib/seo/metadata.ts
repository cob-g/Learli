import type { Metadata } from "next";

export const siteName = "Learli";
export const siteTitle = "One-to-one online tutoring";
export const siteDescription =
  "Learli connects learners and families with one-to-one tutors. Lessons take place with your tutor on Zoom or Google Meet.";

/** Keeps a page out of search results in every environment. */
export const noIndex = { index: false, follow: false } as const;

/** The branded card every page shares, drawn by `src/app/opengraph-image.tsx`. */
export const shareImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: siteName,
  type: "image/png",
} as const;

// A page that sets `openGraph` replaces the parent's whole object, so the
// shared fields travel with every page. Title and description are left out:
// Next fills them, and the Twitter card, from the page's own.
const openGraph: NonNullable<Metadata["openGraph"]> = {
  type: "website",
  siteName,
  images: [shareImage],
};

/**
 * Site-wide defaults for the root layout. Outside an indexable deployment
 * every page is excluded. When indexing is allowed nothing is said here, so a
 * page's own exclusion is never overridden by a blanket "index".
 */
export function siteMetadata({
  origin,
  indexable,
}: {
  origin: URL;
  indexable: boolean;
}): Metadata {
  return {
    metadataBase: origin,
    applicationName: siteName,
    title: {
      default: `${siteTitle} | ${siteName}`,
      template: `%s | ${siteName}`,
    },
    description: siteDescription,
    ...(indexable ? {} : { robots: noIndex }),
    icons: { icon: { url: "/brand/learli-icon.svg", type: "image/svg+xml" } },
    openGraph,
    twitter: { card: "summary_large_image" },
  };
}

type PublicPage = {
  /** Shown before " | Learli". Omit it for the home page's site title. */
  title?: string;
  description?: string;
  /** The page's own address, without visitor filters or selections. */
  path: `/${string}`;
  /** False for a public page that must stay out of search results. */
  index?: boolean;
};

/**
 * Metadata for one public page. Only ever built from public content: nothing
 * from a learner, a booking or a meeting belongs in these fields.
 *
 * It never says "index". Whether the site may be indexed at all is decided
 * once, per request, in the root layout; a page can only opt out.
 */
export function publicPageMetadata({
  title,
  description = siteDescription,
  path,
  index = true,
}: PublicPage): Metadata {
  return {
    ...(title ? { title } : {}),
    description,
    ...(index ? { alternates: { canonical: path } } : { robots: noIndex }),
    openGraph: { ...openGraph, url: path },
  };
}

/**
 * A tutor's page title from their public name and the subjects they list.
 * Two subjects are named at most; a longer list is said to continue.
 */
export function tutorPageTitle(tutor: {
  displayName: string;
  offerings: readonly { subjectName: string }[];
}) {
  const subjects = [
    ...new Set(tutor.offerings.map((item) => item.subjectName)),
  ];
  if (subjects.length === 0) return tutor.displayName;
  if (subjects.length <= 2)
    return `${tutor.displayName}, ${subjects.join(" and ")} tutor`;
  return `${tutor.displayName}, tutor for ${subjects[0]}, ${subjects[1]} and more`;
}
