"use client";

import { useEffect, useRef } from "react";

/** The landing page's diagonal close, shared by every footer. */
export function FooterAccent() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let visible = false;
    const measure = () => {
      frame = 0;
      const box = node.getBoundingClientRect();
      const progress =
        (window.innerHeight - box.top) / (window.innerHeight + box.height);
      node.style.setProperty(
        "--progress",
        Math.min(1, Math.max(0, progress)).toFixed(4),
      );
    };
    const request = () => {
      if (!still.matches && visible && !frame)
        frame = requestAnimationFrame(measure);
    };
    const reveal = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          node.dataset.reveal = "done";
          reveal.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    if (
      !still.matches &&
      node.getBoundingClientRect().top >= window.innerHeight
    ) {
      node.dataset.reveal = "pending";
      reveal.observe(node);
    }
    const watch = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      request();
    });
    watch.observe(node);
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    return () => {
      reveal.disconnect();
      watch.disconnect();
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={root} className="site-footer-accent" aria-hidden="true">
      <div className="site-footer-art">
        <span className="site-footer-ribbon" />
        <span className="site-footer-stop" />
        <span className="site-footer-wedge" />
      </div>
    </div>
  );
}
