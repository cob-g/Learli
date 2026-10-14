import type { MetadataRoute } from "next";
import { readPublicCatalog } from "@/features/tutors/public";
import { sitemapEntries } from "@/lib/seo/crawling";
import { indexingAllowed, siteOrigin } from "@/lib/seo/site";

export const dynamic = "force-dynamic";

/**
 * Empty wherever indexing is not allowed. Tutor addresses come from the public
 * directory's own read, so only tutors the directory already lists appear. If
 * that read fails, the fixed pages are still returned.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexingAllowed()) return [];
  const catalog = await readPublicCatalog();
  return sitemapEntries({
    origin: siteOrigin(),
    tutorSlugs: catalog?.tutors.map((tutor) => tutor.slug) ?? [],
  });
}
