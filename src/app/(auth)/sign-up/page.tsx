import { getAuthPresentation } from "@/lib/auth";
import type { Metadata } from "next";
import { AuthFrame } from "@/features/auth/auth-frame";
import { AuthForm } from "@/features/auth/auth-form";
import { PendingBookingChoice } from "@/features/bookings/pending-choice";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Create an account",
  referrer: "no-referrer",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; token?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthFrame title="Create account" presentation="sign-up">
      <PendingBookingChoice next={params.next} />
      <AuthForm
        {...getAuthPresentation()}
        mode="sign-up"
        presentation="sign-up-reference"
        next={params.next}
        token={params.token}
        invalidToken={!!params.error}
      />
    </AuthFrame>
  );
}
