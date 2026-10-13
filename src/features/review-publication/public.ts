import "server-only";
import { getAuthRuntime } from "@/lib/auth";
import { publicationContext } from "./composition";
import { readPublicReviews } from "./service";
/** Disabled means absent; a failed enabled read is unavailable, never a fabricated zero. */
export async function loadPublicReviews(slug: string) {
  try {
    const runtime = getAuthRuntime();
    if (!runtime) return null;
    const c = publicationContext(runtime);
    if (c.publication.authority === "disabled") return null;
    return await readPublicReviews(c, slug);
  } catch {
    return undefined;
  }
}
