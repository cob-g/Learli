import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuthRuntime } from "@/lib/auth";
import { roles, type Role } from "@/lib/db/schema/app";
import { AccessError, requireRole } from "@/lib/permissions/access";
import { readAccount } from "@/features/account/service";
import { SignOut } from "@/features/auth/sign-out";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your workspace",
  robots: { index: false, follow: false },
};
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  if (!roles.includes(workspace as Role)) notFound();
  // Student and parent have explicit booking dashboards; keep other routing.
  if (workspace === "student" || workspace === "parent") notFound();
  let account;
  try {
    const runtime = getAuthRuntime();
    if (!runtime) throw new AccessError(503);
    const requestHeaders = await headers();
    await requireRole(runtime, requestHeaders, workspace as Role);
    account = await readAccount(runtime, requestHeaders);
  } catch (error) {
    if (error instanceof AccessError && error.status === 401)
      redirect(`/sign-in?next=${encodeURIComponent(`/${workspace}`)}`);
    return (
      <UnavailablePage
        title="Workspace access unavailable"
        message="This workspace is not available to your current account. Return to your account to see your assigned access."
      />
    );
  }
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">
        {workspace.charAt(0).toUpperCase() + workspace.slice(1)} workspace
      </h1>
      <p className="mt-4 text-body">Signed in as {account.email}</p>
      <p className="mt-4 max-w-prose text-body">
        Your local account has this workspace role. Lessons are not available
        yet.
      </p>
      <Link className="mt-8 inline-flex min-h-11 items-center" href="/account">
        Account settings
      </Link>
      <SignOut />
    </div>
  );
}
