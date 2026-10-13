"use client";

import { useEffect, useRef, type ReactNode } from "react";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Scroll-linked presentation for the public home page. The server markup is
 * complete without it. Two behaviours, both expressed as attributes and one
 * custom property that home.css reads:
 *
 * - `[data-reveal]`: a decorative stroke is withheld only while its element is
 *   still below the viewport, then released as it arrives. An element with
 *   `[data-reveal-group]` releases every `[data-reveal]` inside it at once.
 * - `[data-scrub]`: `--progress` (0 to 1) follows the element through the
 *   viewport; "through" measures the viewport's middle against its height.
 *
 * It also marks the document when the browser can refract a backdrop through
 * an SVG filter (Chromium), moves a sheet's glint to the pointer, leans each
 * `[data-tilt]` scene toward a fine pointer, and holds the hero scene's two
 * halves back until both have loaded.
 *
 * Reduced motion skips the reveal, scrub, glint and tilt. No behaviour captures or locks the pointer.
 */
export function HomeMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scope = root.current;
    if (!scope) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: (() => void)[] = [];

    if (!still) {
      // A group is revealed as one: its members wait with it and arrive with
      // it, however they sit on the page. The attribute's value is the media
      // query under which the grouping applies.
      const grouped = (element: Element) => {
        const query = element.getAttribute("data-reveal-group");
        return query !== null && window.matchMedia(query).matches;
      };
      const mark = (element: Element, state: "pending" | "done") => {
        element.setAttribute("data-reveal", state);
        if (!grouped(element)) return;
        for (const member of element.querySelectorAll("[data-reveal]"))
          member.setAttribute("data-reveal", state);
      };
      const reveal = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            mark(entry.target, "done");
            reveal.unobserve(entry.target);
          }
        },
        { rootMargin: "0px 0px -15% 0px" },
      );
      for (const element of scope.querySelectorAll("[data-reveal]")) {
        const group = element.parentElement?.closest("[data-reveal-group]");
        if (group && grouped(group)) continue;
        if (element.getBoundingClientRect().top < window.innerHeight) continue;
        mark(element, "pending");
        reveal.observe(element);
      }
      cleanups.push(() => reveal.disconnect());
    }

    if (!still) {
      const visible = new Set<HTMLElement>();
      let frame = 0;
      const measure = (element: HTMLElement) => {
        const box = element.getBoundingClientRect();
        const viewport = window.innerHeight;
        const progress =
          element.dataset.scrub === "through"
            ? (viewport / 2 - box.top) / box.height
            : (viewport - box.top) / (viewport + box.height);
        element.style.setProperty("--progress", clamp(progress).toFixed(4));
      };
      const update = () => {
        frame = 0;
        for (const element of visible) measure(element);
      };
      const request = () => {
        if (!frame) frame = requestAnimationFrame(update);
      };
      const watch = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          if (entry.isIntersecting) visible.add(element);
          else visible.delete(element);
          // Settle at the end value once it has left the viewport.
          measure(element);
        }
      });
      for (const element of scope.querySelectorAll("[data-scrub]"))
        watch.observe(element);
      window.addEventListener("scroll", request, { passive: true });
      window.addEventListener("resize", request);
      cleanups.push(() => {
        watch.disconnect();
        window.removeEventListener("scroll", request);
        window.removeEventListener("resize", request);
        if (frame) cancelAnimationFrame(frame);
      });
    }

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

    // Depth: each `[data-tilt]` scene eases toward the pointer while it is over
    // that scene's section, and back to rest. It runs only while it has
    // somewhere to go.
    if (
      !still &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches
    ) {
      for (const depth of scope.querySelectorAll<HTMLElement>("[data-tilt]")) {
        const area = depth.closest("section") ?? depth;
        const target = { x: 0, y: 0 };
        const now = { x: 0, y: 0 };
        let lean = 0;
        const ease = () => {
          now.x += (target.x - now.x) * 0.09;
          now.y += (target.y - now.y) * 0.09;
          depth.style.setProperty("--tilt-x", now.x.toFixed(4));
          depth.style.setProperty("--tilt-y", now.y.toFixed(4));
          const far = Math.abs(target.x - now.x) + Math.abs(target.y - now.y);
          lean = far > 0.002 ? requestAnimationFrame(ease) : 0;
        };
        const follow = (event: Event) => {
          const pointer = event as PointerEvent;
          const box = depth.getBoundingClientRect();
          target.x = clamp((pointer.clientX - box.left) / box.width) * 2 - 1;
          target.y = clamp((pointer.clientY - box.top) / box.height) * 2 - 1;
          if (!lean) lean = requestAnimationFrame(ease);
        };
        const rest = () => {
          target.x = 0;
          target.y = 0;
          if (!lean) lean = requestAnimationFrame(ease);
        };
        area.addEventListener("pointermove", follow, { passive: true });
        area.addEventListener("pointerleave", rest);
        cleanups.push(() => {
          area.removeEventListener("pointermove", follow);
          area.removeEventListener("pointerleave", rest);
          if (lean) cancelAnimationFrame(lean);
        });
      }
    }

    // The room and the learner are two halves of one photograph: show them
    // together, never a learner on an empty frame or a room with nobody in it.
    const scene = scope.querySelector("[data-scene]");
    if (scene) {
      const halves = [
        ...scene.querySelectorAll<HTMLImageElement>("img[data-plane]"),
      ];
      if (halves.some((image) => !image.complete)) {
        scene.setAttribute("data-loading", "");
        const settle = () => {
          if (halves.every((image) => image.complete))
            scene.removeAttribute("data-loading");
        };
        for (const image of halves) {
          image.addEventListener("load", settle);
          image.addEventListener("error", settle);
        }
        // A stalled request must not leave the frame empty.
        const giveUp = window.setTimeout(
          () => scene.removeAttribute("data-loading"),
          4000,
        );
        cleanups.push(() => {
          window.clearTimeout(giveUp);
          for (const image of halves) {
            image.removeEventListener("load", settle);
            image.removeEventListener("error", settle);
          }
        });
      }
    }

    // In-page cue: glide to the section, then hand it keyboard focus.
    const glide = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>(
        "a[data-glide]",
      );
      const target = link && document.getElementById(link.hash.slice(1));
      if (!link || !target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: still ? "auto" : "smooth" });
      target.focus({ preventScroll: true });
      history.replaceState(null, "", link.hash);
    };
    scope.addEventListener("click", glide);
    cleanups.push(() => scope.removeEventListener("click", glide));

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  return (
    <div ref={root} className="home">
      {children}
    </div>
  );
}
