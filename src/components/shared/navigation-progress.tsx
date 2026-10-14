"use client";

import { useEffect, useOptimistic, useState } from "react";

/** Sent by `src/instrumentation-client.ts` when the router starts a navigation. */
export const navigationStartEvent = "learli:navigation-start";

/** A navigation quicker than this shows nothing, so fast pages do not flash. */
const delayMillis = 150;

function Notice() {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLate(true), delayMillis);
    return () => clearTimeout(timer);
  }, []);
  return late ? (
    <>
      <span className="navigation-progress-track" aria-hidden="true" />
      <span className="sr-only">Loading page…</span>
    </>
  ) : null;
}

/**
 * A thin bar along the top edge while the next page is on its way. Pages here
 * await their data, so the page being left stays on screen until the new one is
 * ready; without this a slow click looks like nothing happened.
 *
 * The router reports the start inside its own transition, and the flag is set
 * there as optimistic state, so React drops it when that navigation commits,
 * fails or is replaced. It is how `useLinkStatus` works, without a child in
 * every link, and no URL comparison or timer can leave the bar stuck. Without
 * scripts nothing is drawn and the browser shows its own loading state.
 *
 * The wrapper is a plain live region, not `role="status"`: it is on every page,
 * and pages keep that role for their own messages.
 */
export function NavigationProgress() {
  const [pending, setPending] = useOptimistic(false);
  useEffect(() => {
    const start = () => setPending(true);
    window.addEventListener(navigationStartEvent, start);
    return () => window.removeEventListener(navigationStartEvent, start);
  }, [setPending]);
  return (
    <div className="navigation-progress" aria-live="polite" aria-atomic="true">
      {pending && <Notice />}
    </div>
  );
}
