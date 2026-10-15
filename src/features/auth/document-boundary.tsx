"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { authClient } from "@/lib/auth-client";

// App Router can retain a prior document's inline bootstrap after navigation.
// This flag describes only this document's lifetime, never session authority.
let containedPrivateContent = false;
const subscribe = () => () => {};
const privateSnapshot = () => containedPrivateContent;
const serverSnapshot = () => false;

type DocumentIdentity = { id: string; sessionId: string };

export function PrivateDocumentBoundary({
  children,
  initialIdentity = null,
}: {
  children: ReactNode;
  /** Identity from the server's guarded read for this private document. */
  initialIdentity?: DocumentIdentity | null;
}) {
  // Shares the provider's existing session atom with the workspace chrome;
  // subscribing adds no separate read or polling loop.
  const session = authClient.useSession();
  const [identity, setIdentity] = useState(initialIdentity);
  const [replacing, setReplacing] = useState(false);
  const replacementStarted = useRef(false);
  const settled =
    !session.isPending &&
    !session.isRefetching &&
    (!session.error || session.error.status === 401);
  if (settled && !replacing) {
    const current = session.data;
    if (!identity && current) {
      // If server identity authorization was unavailable, there is no trusted
      // binding to compare. Track later provider transitions without looping
      // on a missing identity; page guards still decide what may be rendered.
      setIdentity({ id: current.user.id, sessionId: current.session.id });
    } else if (
      identity &&
      (!current ||
        current.user.id !== identity.id ||
        current.session.id !== identity.sessionId)
    ) {
      // Latch before children commit. Even A -> B -> A cannot revive private
      // state while replacement is pending; changing chrome alone is unsafe.
      setReplacing(true);
    }
  }
  useEffect(() => {
    if (!replacing || replacementStarted.current) return;
    replacementStarted.current = true;
    // Unmounting clears rendered state, but only a new document releases the
    // preceding server's inline private bootstrap and reauthorizes this URL.
    // replace(href) can be a same-document navigation when href has a fragment.
    // Reload always replaces the document, retaining the exact URL and history.
    window.location.reload();
  }, [replacing]);
  useEffect(() => {
    if (containedPrivateContent) return;
    containedPrivateContent = true;
    const revalidateRestoredDocument = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    // Keep this guard for the whole marked document, including after the private
    // layout unmounts. Full document replacement releases it naturally.
    window.addEventListener("pageshow", revalidateRestoredDocument);
  }, []);
  return replacing ? (
    <p role="status" className="page-shell py-12 text-body">
      Loading account access…
    </p>
  ) : (
    children
  );
}

export function PublicAuthDocumentBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const replaceDocument = useSyncExternalStore(
    subscribe,
    privateSnapshot,
    serverSnapshot,
  );
  useEffect(() => {
    if (replaceDocument) window.location.replace(window.location.href);
  }, [replaceDocument]);
  // Do not render a usable public auth form in the preceding private document.
  // The fresh GET retains next/reset/verification parameters and server guards.
  return replaceDocument ? (
    <p role="status" className="page-shell py-12 text-body">
      Loading account access…
    </p>
  ) : (
    children
  );
}
