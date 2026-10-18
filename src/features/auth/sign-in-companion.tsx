"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useHydrated } from "@/hooks/use-hydrated";

const subscribeVisibility = (notify: () => void) => {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
};
const documentVisible = () => document.visibilityState !== "hidden";
const serverVisible = () => false;

export function SignInCompanion({ children }: { children: ReactNode }) {
  const ready = useHydrated();
  const panel = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [finished, setFinished] = useState(false);
  const visible = useSyncExternalStore(
    subscribeVisibility,
    documentVisible,
    serverVisible,
  );
  const supported = ready && typeof IntersectionObserver !== "undefined";

  useEffect(() => {
    const element = panel.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    });
    observer.observe(element);
    const finish = window.setTimeout(() => setFinished(true), 4500);
    return () => {
      window.clearTimeout(finish);
      observer.disconnect();
    };
  }, []);

  return (
    <aside
      ref={panel}
      className="sign-in-companion"
      aria-label="Tutoring artwork"
    >
      <div
        className="sign-in-art"
        aria-hidden="true"
        data-motion-running={
          supported && inView && visible && !finished ? "" : undefined
        }
      >
        {children}
      </div>
    </aside>
  );
}
