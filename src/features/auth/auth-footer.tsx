"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function AuthFooter({
  signUpFooter,
  defaultFooter,
}: {
  signUpFooter: ReactNode;
  defaultFooter: ReactNode;
}) {
  const pathname = usePathname();
  return pathname === "/sign-up" || pathname === "/sign-in"
    ? signUpFooter
    : defaultFooter;
}
