"use client";
import { useState, useEffect, type ReactNode } from "react";
import { flushSync } from "react-dom";

/** Native GET remains usable without JavaScript; enhancement only reports pending. */
export function ProfileFilterForm({
  action,
  children,
}: {
  action: string;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const restore = () => setPending(false);
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  return (
    <form
      action={action}
      method="get"
      onSubmit={() => flushSync(() => setPending(true))}
      aria-busy={pending}
      className="mt-6 flex max-w-xl flex-col gap-4 border-b border-border pb-6"
    >
      {children}
      <button
        type="submit"
        className="action action-outline"
        disabled={pending}
      >
        {pending ? "Loading open times…" : "Load open times"}
      </button>
      {pending && (
        <p role="status" className="text-small">
          Loading open times
        </p>
      )}
    </form>
  );
}
