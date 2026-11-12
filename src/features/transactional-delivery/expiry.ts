import "server-only";
import { sql } from "drizzle-orm";
import type { AuthRuntime } from "@/lib/auth-factory";
import { bindLocalTransactionalDelivery } from "./context";
import { parseServerEnv } from "@/lib/env/schema";

/** Local activity/recovery only. The existing SQL function owns expiry policy,
 * tutor-first locking, and atomic booking/event/queue creation. */
export async function reconcileLocalBookingExpiry(runtime: AuthRuntime) {
  if (!bindLocalTransactionalDelivery(runtime)) return;
  const recipient = parseServerEnv(process.env).LOCAL_VERIFICATION_RECIPIENT;
  const due = await runtime.db.execute<{ tutorId: string }>(sql`
    SELECT DISTINCT b.tutor_id AS "tutorId"
    FROM public.bookings b
    JOIN public.tutor_profiles t ON t.id=b.tutor_id
    JOIN public."user" u ON (u.id=b.booked_by_user_id OR u.id=t.user_id)
    JOIN public.user_access a ON a.user_id=u.id
    WHERE b.source='local_operation' AND b.state='provisional'
      AND b.expires_at<=clock_timestamp()
      AND u.email=${recipient} AND u.email_verified AND a.status='active'
    ORDER BY b.tutor_id LIMIT 25
  `);
  for (const { tutorId } of due.rows) {
    // Recheck current configuration before each short transaction. No provider
    // call happens while any tutor/booking lock is held.
    if (!bindLocalTransactionalDelivery(runtime)) return;
    await runtime.db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL lock_timeout='250ms'`);
      await tx.execute(sql`SET LOCAL statement_timeout='3s'`);
      await tx.execute(
        sql`SELECT public.expire_policy_bookings(${tutorId}::uuid)`,
      );
    });
  }
}
