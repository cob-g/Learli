"use client";

import Link from "next/link";
import {
  BookOpen,
  House,
  ListChecks,
  Presentation,
  Search,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { BrandLogo } from "@/components/shared/brand-logo";

const links = [
  ["/tutors", "Find a tutor"],
  ["/get-matched", "Get matched"],
  ["/subjects", "Subjects"],
  ["/become-a-tutor", "Become a tutor"],
] as const;

/**
 * The same destinations for small screens, plus home, with a one-word label
 * under an icon. `rest` completes a label for assistive technology where the
 * short word alone would be vague.
 */
const dock: { href: string; icon: LucideIcon; label: string; rest?: string }[] =
  [
    { href: "/", icon: House, label: "Home" },
    { href: "/tutors", icon: Search, label: "Find", rest: " a tutor" },
    { href: "/get-matched", icon: ListChecks, label: "Match" },
    { href: "/subjects", icon: BookOpen, label: "Subjects" },
    { href: "/become-a-tutor", icon: Presentation, label: "Teach" },
  ];

const idle = () => () => {};
const onScroll = (notify: () => void) => {
  window.addEventListener("scroll", notify, { passive: true });
  return () => window.removeEventListener("scroll", notify);
};

export function SiteHeader() {
  const pathname = usePathname();
  // The shared bar is transparent at the top and takes on glass over content.
  const live = useSyncExternalStore(
    idle,
    () => true,
    () => false,
  );
  const raised = useSyncExternalStore(
    onScroll,
    () => window.scrollY > 8,
    () => false,
  );
  /** The page itself, or the section a deeper page belongs to. */
  const current = (href: string) =>
    pathname === href
      ? "page"
      : href !== "/" && pathname.startsWith(`${href}/`)
        ? "true"
        : undefined;

  return (
    <>
      <header
        className="site-header"
        data-live={live ? "" : undefined}
        data-raised={raised ? "" : undefined}
      >
        <div
          className="site-header-bar glass glass-liquid flex min-h-16 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 lg:min-h-18"
          data-glint=""
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
          <Link
            href="/sign-in"
            className="nav-link"
            aria-current={pathname === "/sign-in" ? "page" : undefined}
          >
            Sign in
          </Link>
        </div>
      </header>
      {/* Below the wide breakpoint the main navigation is a floating dock at
          the foot of the screen (site-shell.css). Only one of the two navs is
          ever displayed, so they share one name. */}
      <nav
        aria-label="Main navigation"
        className="site-dock glass glass-liquid rounded-full"
        data-glint=""
      >
        <div className="site-dock-track rounded-full">
          {dock.map(({ href, icon: Icon, label, rest }) => (
            <Link
              key={href}
              href={href}
              className="site-dock-link rounded-full"
              aria-current={current(href)}
            >
              <Icon size={22} aria-hidden="true" />
              <span className="site-dock-label">
                {label}
                {rest && <span className="sr-only">{rest}</span>}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
