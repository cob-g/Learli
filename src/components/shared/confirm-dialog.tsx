"use client";

import { useId, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";

/**
 * Confirmation for an action that changes someone's standing. A native modal
 * dialog supplies the focus trap, Escape, and focus return to the trigger.
 */
export function ConfirmDialog({
  ref,
  title,
  children,
  confirmLabel,
  dismissLabel,
  destructive = false,
  pending = false,
  onConfirm,
}: {
  ref: RefObject<HTMLDialogElement | null>;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  dismissLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const titleId = useId();
  return (
    <dialog ref={ref} aria-labelledby={titleId} className="confirm-dialog">
      <h2 id={titleId} className="text-item-title">
        {title}
      </h2>
      <div className="mt-2 text-body">{children}</div>
      <div className="mt-6 flex flex-wrap gap-4">
        <button
          type="button"
          className={cn(
            "action",
            destructive ? "action-destructive" : "action-primary",
          )}
          aria-disabled={pending}
          aria-busy={pending}
          onClick={() => {
            if (!pending) onConfirm();
          }}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          className="action action-outline"
          onClick={() => ref.current?.close()}
        >
          {dismissLabel}
        </button>
      </div>
    </dialog>
  );
}
