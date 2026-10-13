import { getServerEnv } from "@/lib/env/server";
import type { Metadata } from "next";
import { AuthFrame } from "@/features/auth/auth-frame";
import { AuthForm } from "@/features/auth/auth-form";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reset your password",
  referrer: "no-referrer",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; token?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthFrame title="Reset your password">
      <AuthForm
        hosted={getServerEnv().AUTH_MODE === "hosted-synthetic"}
        mode="forgot"
        next={params.next}
        token={params.token}
        invalidToken={!!params.error}
      />
    </AuthFrame>
  );
}
