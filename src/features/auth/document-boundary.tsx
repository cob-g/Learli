"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";

// App Router can retain a prior document's inline bootstrap after navigation.
// This flag describes only this document's lifetime, never session authority.
let containedPrivateContent = false;
const subscribe = () => () => {};
const privateSnapshot = () => containedPrivateContent;
const serverSnapshot = () => false;

export function PrivateDocumentBoundary({ children }: { children: ReactNode }) {
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
  return children;
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
