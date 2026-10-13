import { loadPrivatePage } from "@/lib/permissions/workspace";
import { getSafeguardingContext } from "@/features/safeguarding/composition";
import { readSafetyRestriction } from "@/features/safeguarding/service";
import { SafetyRestrictionForm } from "@/features/safeguarding/restriction-form";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Account safety action",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ targetId: string }>;
}) {
  const { targetId } = await params;
  const target = await loadPrivatePage(
    "/admin/safeguarding/accounts/" + targetId,
    (runtime, headers) =>
      readSafetyRestriction(getSafeguardingContext(runtime), headers, targetId),
  );
  return (
    <section className="page-shell page-space">
      <h1 className="text-page-title">Synthetic account safety action</h1>
      {!target ? (
        <p className="mt-4 text-body">
          This target is unavailable to this account.
        </p>
      ) : (
        <>
          <p className="mt-4 text-body">
            {target.name}: {target.status}
          </p>
          <SafetyRestrictionForm
            key={target.revision}
            targetId={targetId}
            revision={target.revision}
            status={target.status}
          />
        </>
      )}
    </section>
  );
}
