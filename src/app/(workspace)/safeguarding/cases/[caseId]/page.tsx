import { queryCaseBooking } from "@/features/support-bookings/query";
import { SupportBookingSection } from "@/features/support-bookings/presentation";
import { requireIdentity } from "@/lib/permissions/access";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { getSafeguardingContext } from "@/features/safeguarding/composition";
import { readSafeguardingCase } from "@/features/safeguarding/service";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Safeguarding case",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const scope = "requester" as const;
  const detail = await loadPrivatePage(
    "/safeguarding/cases/" + caseId,
    (runtime, headers) =>
      readSafeguardingCase(
        getSafeguardingContext(runtime),
        headers,
        caseId,
        scope,
      ),
  );
  const booking = await loadPrivatePage(
    `/safeguarding/cases/${caseId}`,
    async (runtime, headers) =>
      queryCaseBooking(
        runtime.db,
        await requireIdentity(runtime, headers),
        caseId,
        "requester",
      ),
  );
  return (
    <section className="page-shell page-space">
      <h1 className="text-page-title">Synthetic safeguarding case</h1>
      {!detail ? (
        <p className="mt-4 text-body">
          This case is unavailable to this account.
        </p>
      ) : (
        <>
          <p className="mt-4 text-body">
            {detail.status} · Revision {detail.revision}
          </p>
          {detail.subject && (
            <h2 className="mt-6 text-section-title">{detail.subject}</h2>
          )}
          {detail.body && (
            <p className="mt-4 max-w-prose text-body wrap-anywhere whitespace-pre-wrap">
              {detail.body}
            </p>
          )}
          <p className="mt-4 text-body">
            Assigned reviewer: {detail.reviewer ?? "Not assigned"}
          </p>
          <p className="mt-4 text-body">
            {detail.acknowledgedAt
              ? "Current assignment acknowledged"
              : "Current assignment not acknowledged"}
          </p>
          {detail.escalationRequestedAt && (
            <p className="mt-4 text-body">Escalation requested</p>
          )}
          <h2 className="mt-8 text-section-title">Saved action history</h2>
          <ul className="mt-4 divide-y divide-border">
            {detail.history.map((e) => (
              <li key={e.revision} className="py-3 text-body">
                {e.action.replaceAll("_", " ")} · Revision {e.revision}
              </li>
            ))}
          </ul>
        </>
      )}
      {detail && booking && <SupportBookingSection booking={booking} />}
    </section>
  );
}
