"use client";

import { useEffect } from "react";

/** Shared refraction filters and pointer glints, with a frosted fallback. */
export function GlassEffects() {
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: (() => void)[] = [];
    // Only Chromium accepts an SVG filter as a backdrop; it is also the only
    // engine that exposes this API. Everything else keeps the frosted sheet.
    if ("userAgentData" in navigator) {
      document.documentElement.dataset.glass = "liquid";
      cleanups.push(() => delete document.documentElement.dataset.glass);
    }

    // The header sits outside this component, so the glint listens document-wide.
    if (!still && window.matchMedia("(hover: hover)").matches) {
      const glint = (event: PointerEvent) => {
        const sheet = (event.target as Element).closest<HTMLElement>(
          "[data-glint]",
        );
        if (!sheet) return;
        const box = sheet.getBoundingClientRect();
        sheet.style.setProperty("--glint-x", `${event.clientX - box.left}px`);
        sheet.style.setProperty("--glint-y", `${event.clientY - box.top}px`);
      };
      document.addEventListener("pointermove", glint, { passive: true });
      cleanups.push(() => document.removeEventListener("pointermove", glint));
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      className="absolute"
    >
      <defs>
        {/* Broad, slow waves for panels. */}
        <filter
          id="learli-glass"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.014"
            numOctaves="1"
            seed="7"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="3" result="soft" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="soft"
            scale="46"
            xChannelSelector="R"
            yChannelSelector="B"
            result="bent"
          />
          <feGaussianBlur in="bent" stdDeviation="5" />
        </filter>
        {/* Tighter ripples for buttons. */}
        <filter
          id="learli-glass-fine"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04 0.05"
            numOctaves="1"
            seed="3"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="soft"
            scale="36"
            xChannelSelector="R"
            yChannelSelector="B"
            result="bent"
          />
          <feGaussianBlur in="bent" stdDeviation="3" />
        </filter>
      </defs>
    </svg>
  );
}
