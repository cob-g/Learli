"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useRef, useSyncExternalStore } from "react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { cn } from "@/lib/utils";

const links = [
  ["/tutors", "Find a tutor"],
  ["/get-matched", "Get matched"],
  ["/subjects", "Subjects"],
  ["/become-a-tutor", "Become a tutor"],
] as const;

const idle = () => () => {};
const onScroll = (notify: () => void) => {
  window.addEventListener("scroll", notify, { passive: true });
  return () => window.removeEventListener("scroll", notify);
};

export function SiteHeader() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  // On the public home page the header is transparent and spans the viewport.
  // Once scripts run it stays on screen, and takes on glass (home.css) only
  // when the page has moved beneath it, so its labels never sit on raw content.
  const home = pathname === "/";
  const live = useSyncExternalStore(
    idle,
    () => true,
    () => false,
  );
  const raised = useSyncExternalStore(
    home ? onScroll : idle,
    () => window.scrollY > 8,
    () => false,
  );

  return (
    <header
      className={home ? "home-header" : "border-b border-border bg-surface"}
      data-live={home && live ? "" : undefined}
      data-raised={home && raised ? "" : undefined}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2",
          home
            ? "home-header-bar glass glass-liquid min-h-16 lg:min-h-18"
            : "page-shell min-h-20 lg:min-h-24",
        )}
        data-glint={home ? "" : undefined}
      >
        <Link href="/" className="brand-home" aria-label="Learli home">
          <BrandLogo />
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-6 lg:flex"
        >
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="nav-link"
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-3 sm:gap-6">
          <Link
            href="/sign-in"
            className="nav-link"
            aria-current={pathname === "/sign-in" ? "page" : undefined}
          >
            Sign in
          </Link>
          <button
            ref={menuTrigger}
            type="button"
            className="action action-outline lg:hidden"
            aria-haspopup="dialog"
            onClick={() => dialog.current?.showModal()}
          >
            <Menu size={20} aria-hidden="true" /> Menu
          </button>
        </div>
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="menu-title"
        className="mobile-menu"
        onClose={() => menuTrigger.current?.focus()}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="menu-title" className="text-item-title">
            Menu
          </h2>
          <button
            type="button"
            className="action action-outline"
            aria-label="Close menu"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav
          aria-label="Mobile navigation"
          className="mt-8 flex flex-col gap-2"
        >
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="nav-link"
              aria-current={pathname === href ? "page" : undefined}
              onClick={() => dialog.current?.close()}
            >
              {label}
            </Link>
          ))}
        </nav>
      </dialog>
    </header>
  );
}
