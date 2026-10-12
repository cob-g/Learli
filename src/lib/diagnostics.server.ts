// Node-only: shared by server runtime and plain Node local tooling. Importing
// node:perf_hooks keeps this out of browser bundles without breaking tsx tooling.
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

type DiagnosticCategory =
  | "mutation.unavailable"
  | "mutation.failed"
  | "database.setup_failed"
  | "database.pool_failed";

const windowMilliseconds = 60_000;
const maxEventsPerWindow = 20;
let windowStarted = 0;
let attempts = 0;

/** No error, request, caller ID or free-form metadata is ever accepted. */
export function emitDiagnostic(category: DiagnosticCategory): void {
  // Keep the runtime boundary closed too; never coerce an unexpected value.
  if (
    category !== "mutation.unavailable" &&
    category !== "mutation.failed" &&
    category !== "database.setup_failed" &&
    category !== "database.pool_failed"
  )
    return;
  try {
    const now = performance.now();
    if (now - windowStarted >= windowMilliseconds) {
      windowStarted = now;
      attempts = 0;
    }
    if (attempts >= maxEventsPerWindow) return;
    attempts++;
    console.error(
      JSON.stringify({
        event: category,
        correlationId: randomUUID(),
      }),
    );
  } catch {
    // Even a failing logger/UUID source must not alter a mutation or pool event.
  }
}
