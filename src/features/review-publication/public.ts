import "server-only";
import { getDomainAuthRuntime } from "@/lib/auth";
import { publicationContext } from "./composition";
import { readPublicReviews } from "./service";
/** Disabled means absent; a failed enabled read is unavailable, never a fabricated zero. */
export async function loadPublicReviews(slug: string) {
  try {
    const runtime = await getDomainAuthRuntime();
    if (!runtime) return null;
    const c = publicationContext(runtime);
    if (c.publication.authority === "disabled") return null;
    return await readPublicReviews(c, slug);
  } catch {
    return undefined;
  }
}
