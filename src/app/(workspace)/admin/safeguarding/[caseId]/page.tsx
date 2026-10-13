import { loadPrivatePage } from "@/lib/permissions/workspace";
import { getSafeguardingContext } from "@/features/safeguarding/composition";
import { readSafeguardingCase } from "@/features/safeguarding/service";
import { ResponseForm } from "@/features/safeguarding/forms";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Safeguarding case",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ scope?: string }>;
}) {
  const { caseId } = await params,
    query = await searchParams;
  const scope = query.scope === "dispatcher" ? "dispatcher" : "reviewer";
  const detail = await loadPrivatePage(
    "/admin/safeguarding/" + caseId,
    (runtime, headers) =>
      readSafeguardingCase(
        getSafeguardingContext(runtime),
        headers,
        caseId,
        scope,
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
          <ResponseForm key={detail.revision} detail={detail} scope={scope} />
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
    </section>
  );
}
