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
  searchParams: Promise<{ next?: string; token?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthFrame title="Sign in">
      <PendingBookingChoice next={params.next} />
      <AuthForm
        hosted={getServerEnv().AUTH_MODE === "hosted-synthetic"}
        mode="sign-in"
        next={params.next}
        token={params.token}
        invalidToken={!!params.error}
      />
    </AuthFrame>
  );
}
