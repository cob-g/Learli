import type { MetadataRoute } from "next";

// Development foundation: indexing waits for the approved public launch.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
