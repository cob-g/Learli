import { loadPrivatePage } from "@/lib/permissions/workspace";
import { getSafeguardingContext } from "@/features/safeguarding/composition";
import {
  canIntake,
  listSafeguardingCases,
} from "@/features/safeguarding/service";
import { SafeguardingReportForm } from "@/features/safeguarding/forms";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Report a concern",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const [enabled, reports] = await Promise.all([
    loadPrivatePage("/safeguarding/report", async (runtime) => {
      const c = getSafeguardingContext(runtime);
      return c.safeguarding.mode === "synthetic_test" && (await canIntake(c));
    }),
    // Existing requester authority does not require new intake to be enabled.
    loadPrivatePage("/safeguarding/report", (runtime, headers) =>
      listSafeguardingCases(
        getSafeguardingContext(runtime),
        headers,
        "requester",
      ),
    ),
  ]);
  return (
    <section className="page-shell page-space">
      <h1 className="text-page-title">Report a concern</h1>
      {enabled ? (
        <div className="mt-6 max-w-xl rounded-surface border border-border bg-surface p-6 sm:p-8">
          <SafeguardingReportForm />
        </div>
      ) : enabled === false ? (
        <p className="mt-4 max-w-prose text-body">
          New safeguarding intake is disabled. Actual responsible human owners,
          approved reporting guidance and an operating plan are required before
          activation.
        </p>
      ) : (
        <p className="mt-4 max-w-prose text-body">
          New report intake is unavailable. Reload this page to try again.
        </p>
      )}
      <section id="your-reports" className="mt-8 max-w-xl">
        <h2 className="text-section-title">Your latest reports</h2>
        {!reports ? (
          <div className="mt-4 space-y-2">
            <p className="text-body">Your reports could not be loaded.</p>
            {/* A native document GET retries this current server read. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              className="inline-flex min-h-11 items-center"
              href="/safeguarding/report"
            >
              Reload reports
            </a>
          </div>
        ) : reports.length === 0 ? (
          <p className="mt-4 text-body">
            No currently available reports for this account.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {reports.map((report, index) => (
              <li key={report.id} className="py-4">
                <p className="text-body">
                  Report {index + 1} ·{" "}
                  {report.status === "in_review"
                    ? "In review"
                    : report.status === "closed"
                      ? "Closed"
                      : "Open"}
                </p>
                <a
                  className="inline-flex min-h-11 items-center"
                  href={`/safeguarding/cases/${report.id}`}
                >
                  Open report {index + 1}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
