import { getServerEnv } from "@/lib/env/server";
import type { Metadata } from "next";
import { AuthFrame } from "@/features/auth/auth-frame";
import { AuthForm } from "@/features/auth/auth-form";
import { PendingBookingChoice } from "@/features/bookings/pending-choice";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Verify your email",
  referrer: "no-referrer",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; token?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthFrame title="Verify your email">
      <PendingBookingChoice next={params.next} />
      <AuthForm
        hosted={getServerEnv().AUTH_MODE === "hosted-synthetic"}
        mode="verify"
        next={params.next}
        token={params.token}
        invalidToken={!!params.error}
      />
    </AuthFrame>
  );
}
