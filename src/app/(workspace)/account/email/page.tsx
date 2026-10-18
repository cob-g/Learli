import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAccountAuthRuntime } from "@/lib/auth";
import { AccessError } from "@/lib/permissions/access";
import { readAccount } from "@/features/account/service";
import { EmailForm } from "@/features/account-email/email-form";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Change account email",
  robots: { index: false, follow: false },
};
export default async function AccountEmailPage() {
  let account;
  let hosted = false;
  let localWorkflow = false;
  try {
    const runtime = await getAccountAuthRuntime();
    if (!runtime) throw new AccessError(503);
    hosted = "hosted" in runtime;
    localWorkflow = !!getLocalWorkflow(runtime);
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
      <p className="mt-4 max-w-prose rounded-control border border-border bg-subtle p-4 text-small text-muted-foreground">
        {!localWorkflow && "Synthetic accounts only. "}Reloading this page
        clears the pending form; restart confirmation if needed.
      </p>
      <div className="mt-6 max-w-xl rounded-surface border border-border bg-surface p-6 sm:p-8">
        <EmailForm
          currentEmail={account.email}
          hosted={hosted}
          localWorkflow={localWorkflow}
        />
      </div>
      <Link href="/account" className="mt-8 inline-flex min-h-11 items-center">
        Back to account
      </Link>
    </div>
  );
}
