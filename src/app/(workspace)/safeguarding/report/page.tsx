import { loadPrivatePage } from "@/lib/permissions/workspace";
import { getSafeguardingContext } from "@/features/safeguarding/composition";
import { canIntake } from "@/features/safeguarding/service";
import { SafeguardingReportForm } from "@/features/safeguarding/forms";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Report a concern",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const enabled = await loadPrivatePage(
    "/safeguarding/report",
    async (runtime) => {
      const c = getSafeguardingContext(runtime);
      return c.safeguarding.mode === "synthetic_test" && (await canIntake(c));
    },
  );
  return (
    <section className="page-shell page-space">
      <h1 className="text-page-title">Report a concern</h1>
      {enabled ? (
        <div className="mt-6 max-w-xl rounded-surface border border-border bg-surface p-6 sm:p-8">
          <SafeguardingReportForm />
        </div>
      ) : (
        <p className="mt-4 max-w-prose text-body">
          New safeguarding intake is disabled. Actual responsible human owners,
          approved reporting guidance and an operating plan are required before
          activation.
        </p>
      )}
    </section>
  );
}
