import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { AccessError, requireIdentity } from "@/lib/permissions/access";
import { sql } from "drizzle-orm";
import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import { getSafeguardingContext } from "@/features/safeguarding/composition";
import { BookingDisputeForm } from "@/features/booking-workflows/forms";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Synthetic booking dispute",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params,
    available = await loadPrivatePage(
      `/bookings/${bookingId}/dispute`,
      async (runtime, headers) => {
        if (!z.uuid().safeParse(bookingId).success) throw new AccessError(404);
        const c = bookingWorkflowContext(runtime),
          r = getSafeguardingContext(runtime);
        if (
          c.booking.authority === "disabled" ||
          r.safeguarding.mode === "disabled"
        )
          return false;
        const actor = await requireIdentity(runtime, headers),
          q = await runtime.db.execute<{ ok: boolean }>(
            sql`SELECT public.booking_workflow_participant(${actor.userId},${actor.sessionId},${bookingId}::uuid) AND public.has_current_support_policy(${r.safeguarding.version}) AS ok`,
          );
        return q.rows[0]?.ok === true;
      },
    );
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">Synthetic booking dispute</h1>
      {available ? (
        <BookingDisputeForm bookingId={bookingId} />
      ) : (
        <p className="mt-4 text-body">
          This dispute request is unavailable on this account. An active booking
          relationship and reviewed synthetic response policy are required.
        </p>
      )}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Native navigation replaces the prior private document. */}
      <a className="mt-8 inline-flex min-h-11 items-center" href="/bookings">
        Return to your bookings
      </a>
    </div>
  );
}
