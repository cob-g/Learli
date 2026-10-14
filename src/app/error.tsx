"use client";
import { PublicShell } from "@/components/shared/public-shell";
import { PageError } from "@/components/shared/page-error";
export default function ErrorPage(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PublicShell>
      <PageError {...props} />
    </PublicShell>
  );
}
