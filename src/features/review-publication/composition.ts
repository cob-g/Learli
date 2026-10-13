import type { AuthRuntime } from "@/lib/auth-factory";
import { disabledPublication } from "./policy";
import type { PublicationContext } from "./service";
/** Real default remains disabled. Only an exact test-owned mirror installs readiness policy. */
export function publicationContext(runtime: AuthRuntime): PublicationContext {
  return { runtime, publication: disabledPublication };
}
