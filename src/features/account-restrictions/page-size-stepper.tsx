"use client";

import { useRef } from "react";
import { Minus, Plus } from "lucide-react";
import { useHydrated } from "@/hooks/use-hydrated";

/** The native number input works alone; the buttons only step within its bounds. */
export function PageSizeStepper({ defaultValue }: { defaultValue: number }) {
  const hydrated = useHydrated();
  const input = useRef<HTMLInputElement>(null);
  return (
    <span className="account-step">
      {hydrated && (
        <button
          type="button"
          aria-label="Fewer per page"
          onClick={() => input.current?.stepDown()}
        >
          <Minus size={16} aria-hidden="true" />
        </button>
      )}
      <input
        ref={input}
        className="field"
        id="account-page-size"
        name="pageSize"
        type="number"
        min={1}
        max={20}
        step={1}
        defaultValue={defaultValue}
      />
      {hydrated && (
        <button
          type="button"
          aria-label="More per page"
          onClick={() => input.current?.stepUp()}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
