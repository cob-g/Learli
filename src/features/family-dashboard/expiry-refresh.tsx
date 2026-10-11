"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** A fresh server read projects TTL. No client mutation or confirmation. */
export function ExpiryRefresh({
  expiresAt,
  snapshotAt,
}: {
  expiresAt: string | null;
  snapshotAt: string;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(
      () => router.refresh(),
      Math.max(
        0,
        new Date(expiresAt).getTime() - new Date(snapshotAt).getTime(),
      ) + 250,
    );
    return () => clearTimeout(timer);
  }, [expiresAt, snapshotAt, router]);
  return null;
}
