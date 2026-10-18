import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export function PublicShell({
  children,
  footer = <SiteFooter />,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="public-shell flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
      {footer}
    </div>
  );
}
