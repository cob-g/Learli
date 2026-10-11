"use client";
import { useEffect, useRef } from "react";
export function CaseTitle({ subject }: { subject: string }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
  }, []);
  return (
    <h1 ref={title} tabIndex={-1} className="text-page-title wrap-anywhere">
      {subject}
    </h1>
  );
}
