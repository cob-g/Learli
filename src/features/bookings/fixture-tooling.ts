// Owner tooling only. No route, runtime promotion, arbitrary clock or attendance claim.
import { createHash, randomUUID } from "node:crypto";
import { sql, eq } from "drizzle-orm";
import type { createDatabase } from "@/lib/db/connection";
import { bookings, bookingLifecycleEvents } from "@/lib/db/schema";
import { z } from "zod";
export async function completeHistoricalDemoFixture(
  owner: ReturnType<typeof createDatabase>,
  bookingId: string,
) {
  z.uuid().parse(bookingId);
  if (
    !["learli_dev", "learli_test"].includes(
      owner.pool.options.database ?? "",
    ) ||
    !["127.0.0.1", "localhost", "::1"].includes(owner.pool.options.host ?? "")
  )
    throw new Error("Owned loopback fixture connection required.");
  return owner.db.transaction(
    async (tx) => {
      const who = await tx.execute<{ name: string }>(
        sql`SELECT current_user AS name`,
      );
      if (who.rows[0]?.name === "learli_app")
        throw new Error("Owner fixture connection required.");
      await tx.execute(
        sql`SELECT tp.id FROM tutor_profiles tp JOIN bookings b ON b.tutor_id=tp.id WHERE b.id=${bookingId}::uuid FOR UPDATE OF tp`,
      );
      const [row] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .for("no key update");
      const allowed = await tx.execute(
        sql`SELECT 1 FROM bookings b JOIN "user" u ON u.id=b.booked_by_user_id AND u.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$' JOIN tutor_profiles tp ON tp.id=b.tutor_id JOIN "user" tu ON tu.id=tp.user_id AND tu.email ~* '^[^[:space:]@]+@([a-z0-9-]+[.])+test$' JOIN learner_profiles l ON l.id=b.learner_id AND l.source='local_fixture' WHERE b.id=${bookingId}::uuid AND b.source='local_simulation' AND b.end_at_utc<=clock_timestamp()`,
      );
      if (
        !row ||
        !allowed.rows.length ||
        !["demo_reserved", "demo_confirmed", "demo_completed"].includes(
          row.state,
        )
      )
        throw new Error("Ended synthetic fixture required.");
      if (row.state === "demo_completed")
        return { id: row.id, logicalBookingId: row.logicalBookingId };
      for (const state of row.state === "demo_reserved"
        ? (["demo_confirmed", "demo_completed"] as const)
        : (["demo_completed"] as const)) {
        await tx.update(bookings).set({ state }).where(eq(bookings.id, row.id));
        await tx.insert(bookingLifecycleEvents).values({
          logicalBookingId: row.logicalBookingId,
          bookingId: row.id,
          actorUserId: row.bookedByUserId,
          event: state,
          requestId: randomUUID(),
          requestFingerprint: createHash("sha256")
            .update(`${row.id}:${state}:historical-local-fixture`)
            .digest("hex"),
        });
      }
      return { id: row.id, logicalBookingId: row.logicalBookingId };
    },
    { isolationLevel: "read committed" },
  );
}
