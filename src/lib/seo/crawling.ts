import type { MetadataRoute } from "next";
import { siteDescription, siteName } from "./metadata";

/**
 * The public pages offered to search engines. A page belongs here only if it
 * is public, finished enough to be found, and not excluded in its own
 * metadata: the draft policies and the two demonstration support pages are
 * left out on purpose.
 */
export const indexablePaths = [
  "/",
  "/tutors",
  "/get-matched",
  "/subjects",
  "/how-it-works",
  "/become-a-tutor",
] as const;

/**
 * Never crawled: APIs, account access, every private workspace, and any
 * address carrying a booking or a one-time token. `/tutor` is anchored and
 * given a trailing slash so it cannot swallow the public `/tutors` directory.
 */
export const disallowedPaths = [
  "/api/",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/two-factor",
  "/account",
  "/admin",
  "/bookings",
  "/learner-admission",
  "/learners",
  "/parent",
  "/readiness",
  "/safeguarding",
  "/student",
  "/support",
  "/tutor$",
  "/tutor/",
  "/*?*bookingId=",
  "/*?*token=",
] as const;

const publicSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Everything is closed unless this deployment may be indexed. */
export function robotsRules({
  origin,
  indexable,
}: {
  origin: URL;
  indexable: boolean;
}): MetadataRoute.Robots {
  if (!indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...disallowedPaths] },
    sitemap: new URL("/sitemap.xml", origin).href,
  };
}

/**
 * The indexable pages plus one address per listed tutor. The slugs must come
 * from the public directory's own query, so the sitemap can never name a tutor
 * the directory does not already link to. No dates or priorities are given:
 * none are recorded, and none are invented.
 */
export function sitemapEntries({
  origin,
  tutorSlugs,
}: {
  origin: URL;
  tutorSlugs: readonly string[];
}): MetadataRoute.Sitemap {
  const tutors = [...new Set(tutorSlugs)]
    .filter((slug) => publicSlug.test(slug))
    .map((slug) => `/tutors/${slug}`);
  return [...indexablePaths, ...tutors].map((path) => ({
    url: new URL(path, origin).href,
  }));
}

/**
 * Structured data for the home page: that this is the Learli website, and no
 * more. No organization, ratings, reviews, offers or prices: the legal
 * identity and pricing are undecided, and Learli has no customer reviews.
 */
export function websiteStructuredData(origin: URL) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: new URL("/", origin).href,
    description: siteDescription,
    inLanguage: "en",
  };
}
