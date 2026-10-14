import Link from "next/link";
import { safeBookingReturnPath } from "@/features/bookings/selection";
import { getServerEnv } from "@/lib/env/server";
import type { Metadata } from "next";
import { AuthFrame } from "@/features/auth/auth-frame";
import { AuthForm } from "@/features/auth/auth-form";
import { PendingBookingChoice } from "@/features/bookings/pending-choice";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", referrer: "no-referrer" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    token?: string;
    error?: string;
    verified?: string;
  }>;
}) {
  const params = await searchParams;
  const next = safeBookingReturnPath(params.next);
  return (
    <AuthFrame title="Sign in">
      <PendingBookingChoice next={params.next} />
      {params.error ? (
        <p
          role="alert"
          className="mt-6 rounded-control border border-error p-4 text-body text-error"
        >
          This verification link has expired or is not valid.{" "}
          <Link href={`/verify-email?next=${encodeURIComponent(next)}`}>
            Request a new verification link
          </Link>
          .
        </p>
      ) : (
        params.verified === "1" && (
          <p
            role="status"
            className="mt-6 rounded-control border border-border bg-subtle p-4 text-body"
          >
            Email verified. Sign in to continue.
          </p>
        )
      )}
      <AuthForm
        hosted={getServerEnv().AUTH_MODE === "hosted-synthetic"}
        mode="sign-in"
        next={params.next}
        token={params.token}
      />
    </AuthFrame>
  );
}
