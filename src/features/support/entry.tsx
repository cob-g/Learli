import "server-only";
import Link from "next/link";
import { headers } from "next/headers";
import { getAuthRuntime } from "@/lib/auth";
import { AccessError } from "@/lib/permissions/access";
import { listCases } from "./service";
import { DemoNotice } from "./presentation";
import { CaseForm } from "./case-form";

export async function SupportEntry({ concern = false }: { concern?: boolean }) {
  let available = false,
    anonymous = false;
  try {
    const runtime = getAuthRuntime();
    if (runtime) {
      await listCases(runtime, await headers(), "requester");
      available = true;
    }
  } catch (error) {
    anonymous = error instanceof AccessError && error.status === 401;
  }
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">
        {concern ? "Report a concern" : "Contact support"}
      </h1>
      <DemoNotice />
      {available ? (
        <>
          <CaseForm concern={concern} />
          <Link
            href="/support"
            className="mt-8 inline-flex min-h-11 items-center"
          >
            Your reports
          </Link>
        </>
      ) : (
        <section className="mt-8 max-w-prose">
          <h2 className="text-item-title">
            {anonymous
              ? "Sign in for fictional testing"
              : "Local reporting unavailable"}
          </h2>
          <p className="mt-2 text-body">
            {anonymous
              ? "Use an active verified synthetic account to save a fictional report."
              : "This account cannot use local reporting. Real support operations remain unavailable."}
          </p>
          {anonymous && (
            <Link
              className="action action-primary mt-4"
              href={`/sign-in?next=${concern ? "/report-a-concern" : "/contact"}`}
            >
              Sign in
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
