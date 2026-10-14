"use client";
import { useRef, useState } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useRouter } from "next/navigation";
export function SafetyRestrictionForm({
  targetId,
  revision,
  status,
}: {
  targetId: string;
  revision: number;
  status: "active" | "suspended";
}) {
  const router = useRouter(),
    ready = useHydrated(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    result = useRef<HTMLParagraphElement>(null),
    key = useRef<string | null>(null);
  async function confirm() {
    setBusy(true);
    key.current ??= crypto.randomUUID();
    try {
      const r = await fetch(`/api/admin/safeguarding/accounts/${targetId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          revision,
          requestKey: key.current,
          action: status === "active" ? "restrict" : "restore",
          reason:
            status === "active"
              ? "synthetic_safety_restrict"
              : "synthetic_safety_restore",
        }),
      });
      const v = await r.json();
      if (!r.ok) throw new Error(v.message);
      key.current = null;
      router.refresh();
      setMessage("Synthetic access action saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action is unavailable.");
    } finally {
      setBusy(false);
      dialog.current?.close();
      requestAnimationFrame(() => result.current?.focus());
    }
  }
  return (
    <form
      method="post"
      action={`/api/admin/safeguarding/accounts/${targetId}`}
      className="mt-6"
      onSubmit={(e) => {
        e.preventDefault();
        dialog.current?.showModal();
      }}
    >
      <p className="max-w-prose text-body">
        Changes only this exact synthetic account. Restoration does not
        reinstate screening or revive bookings.
      </p>
      <p ref={result} tabIndex={-1} role="alert" className="mt-4 text-body">
        {message}
      </p>
      <button className="action action-primary mt-4" disabled={!ready || busy}>
        {status === "active"
          ? "Restrict synthetic account"
          : "Restore synthetic account"}
      </button>
      <noscript>
        <p className="mt-4 text-body">
          Enable JavaScript to change account access.
        </p>
      </noscript>
      <ConfirmDialog
        ref={dialog}
        title="Change synthetic account access?"
        confirmLabel="Confirm access action"
        dismissLabel="Keep current access"
        destructive={status === "active"}
        pending={busy}
        onConfirm={() => void confirm()}
      >
        <p>
          This affects only the exact fictional account. Existing booking
          history is preserved.
        </p>
      </ConfirmDialog>
    </form>
  );
}
