import { loadPrivatePage } from "@/lib/permissions/workspace";
import { getSafeguardingContext } from "@/features/safeguarding/composition";
import { listSafeguardingCases } from "@/features/safeguarding/service";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Safeguarding queue",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const rows = await loadPrivatePage(
    "/admin/safeguarding",
    async (runtime, headers) => ({
      dispatch: await listSafeguardingCases(
        getSafeguardingContext(runtime),
        headers,
        "dispatcher",
      ),
      review: await listSafeguardingCases(
        getSafeguardingContext(runtime),
        headers,
        "reviewer",
      ),
    }),
  );
  return (
    <section className="page-shell page-space">
      <h1 className="text-page-title">Synthetic safeguarding queue</h1>
      <p className="mt-4 max-w-prose text-body">
        Assignment and acknowledgment exercise only. This is not a monitored
        response service.
      </p>
      {!rows ? (
        <p className="mt-4 text-body">This queue is unavailable.</p>
      ) : (
        ["dispatch", "review"].map((kind) => (
          <section key={kind} className="mt-8">
            <h2 className="text-section-title">
              {kind === "dispatch"
                ? "Exact dispatch cases"
                : "Assigned review cases"}
            </h2>
            <ul className="mt-4 divide-y divide-border">
              {rows[kind as "dispatch" | "review"].map((c) => (
                <li key={c.id} className="py-4">
                  <p className="text-body">
                    {c.category} · {c.status} · Revision {c.revision}
                  </p>
                  <a
                    className="inline-flex min-h-11 items-center"
                    href={`/admin/safeguarding/${c.id}?scope=${kind === "dispatch" ? "dispatcher" : "reviewer"}`}
                  >
                    Open case
                  </a>
                </li>
              ))}
            </ul>
            {!rows[kind as "dispatch" | "review"].length && (
              <p className="mt-4 text-body">No currently authorized cases.</p>
            )}
          </section>
        ))
      )}
    </section>
  );
}
