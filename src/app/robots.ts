import type { MetadataRoute } from "next";
import { robotsRules } from "@/lib/seo/crawling";
import { indexingAllowed, siteOrigin } from "@/lib/seo/site";

// Answered per request: the rules depend on where this build is running, so
// they must never be frozen into the build.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return robotsRules({ origin: siteOrigin(), indexable: indexingAllowed() });
}
