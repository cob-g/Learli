import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAccountAuthRuntime } from "@/lib/auth";
import { AccessError } from "@/lib/permissions/access";
import { readAccount } from "@/features/account/service";
import { EmailForm } from "@/features/account-email/email-form";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Change account email",
  robots: { index: false, follow: false },
};
export default async function AccountEmailPage() {
  let account;
  let hosted = false;
  try {
    const runtime = await getAccountAuthRuntime();
    if (!runtime) throw new AccessError(503);
    hosted = "hosted" in runtime;
    account = await readAccount(runtime, await headers());
  } catch (error) {
    if (error instanceof AccessError && error.status === 401)
      redirect("/sign-in?next=%2Faccount%2Femail");
    return (
      <UnavailablePage
        title="Account access unavailable"
        message="Your account cannot be opened right now. Check your sign-in status or try again later."
      />
    );
  }
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Change account email</h1>
      <p className="mt-4 max-w-prose text-body text-muted-foreground">
        Synthetic accounts only. Reloading this page clears the pending form;
        restart confirmation if needed.
      </p>
      <EmailForm currentEmail={account.email} hosted={hosted} />
      <Link href="/account" className="mt-8 inline-flex min-h-11 items-center">
        Back to account
      </Link>
    </div>
  );
}
