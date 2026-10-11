// Node-only manual dispatcher. A checked-out independent Pool connection, never
// a booking transaction, is essential to the committed-event visibility boundary.
import { Pool } from "pg";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { z } from "zod";
import type { Database } from "@/lib/db/connection";
import * as schema from "@/lib/db/schema";
import { isLoopbackOrigin } from "@/lib/local-mode";
import { captureBookingNotice } from "./local-capture";
import type { ReservationNotice } from "./template";

export type LocalNoticeRuntime = {
  pool: Pool;
  environment: "development" | "test";
  origin: string;
};
const dispatchInput = z
  .object({
    limit: z.number().int().min(1).max(25).default(25),
    eventId: z.uuid().optional(),
  })
  .strict();
export type DispatchOptions = z.input<typeof dispatchInput>;
export type DispatchResult = {
  captured: number;
  suppressed: number;
  retryable: number;
  skipped: number;
};
export type NoticeResolver = (
  db: Pick<Database, "select" | "execute">,
  eventId: string,
  recipientUserId: string,
) => Promise<ReservationNotice | null>;

function requireLocalDispatch(runtime: LocalNoticeRuntime) {
  if (
    !(runtime.pool instanceof Pool) ||
    !isLoopbackOrigin(runtime.origin) ||
    !["development", "test"].includes(runtime.environment) ||
    !["127.0.0.1", "localhost", "::1"].includes(
      runtime.pool.options.host ?? "",
    ) ||
    runtime.pool.options.ssl !== false ||
    runtime.pool.options.user !== "learli_app" ||
    runtime.pool.options.database !==
      (runtime.environment === "test" ? "learli_test" : "learli_dev")
  )
    throw new Error("Owned local notice dispatch required.");
}

/** Internal engine; the sole production caller supplies the frozen participant resolver. */
export async function drainBookingNotices(
  runtime: LocalNoticeRuntime,
  input: DispatchOptions,
  resolveNotice: NoticeResolver,
): Promise<DispatchResult> {
  requireLocalDispatch(runtime);
  const options = dispatchInput.parse(input);
  const result: DispatchResult = {
    captured: 0,
    suppressed: 0,
    retryable: 0,
    skipped: 0,
  };
  const client = await runtime.pool.connect();
  const db = drizzle(client, { schema });
  const deliveries = schema.bookingNotificationDeliveries;
  try {
    // Snapshot at most one bounded page. A failed row is attempted once per call.
    const candidates = await db
      .select({
        eventId: deliveries.eventId,
        recipientUserId: deliveries.recipientUserId,
        kind: deliveries.kind,
      })
      .from(deliveries)
      .where(
        and(
          eq(deliveries.state, "pending"),
          options.eventId ? eq(deliveries.eventId, options.eventId) : undefined,
        ),
      )
      .orderBy(
        asc(deliveries.createdAt),
        asc(deliveries.eventId),
        asc(deliveries.recipientUserId),
      )
      .limit(options.limit);
    for (const candidate of candidates) {
      await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
      try {
        const identity = and(
          eq(deliveries.eventId, candidate.eventId),
          eq(deliveries.recipientUserId, candidate.recipientUserId),
          eq(deliveries.kind, candidate.kind),
        );
        const [row] = await db
          .select()
          .from(deliveries)
          .where(and(identity, eq(deliveries.state, "pending")))
          .for("update", { skipLocked: true });
        if (!row) {
          await client.query("COMMIT");
          result.skipped++;
          continue;
        }
        // This statement occurs after the queue claim; caller resolver checks
        // current recipient relationship/eligibility and elapsed TTL in SQL.
        const notice = await resolveNotice(
          db,
          row.eventId,
          row.recipientUserId,
        );
        let state: "captured" | "suppressed" | "pending" = notice
          ? "captured"
          : "suppressed";
        if (notice) {
          try {
            await captureBookingNotice({
              environment: runtime.environment,
              origin: runtime.origin,
              eventId: row.eventId,
              recipientUserId: row.recipientUserId,
              notice,
            });
          } catch {
            state = "pending";
          }
        }
        await db
          .update(deliveries)
          .set({
            state,
            attempts: row.attempts + 1,
            lastAttemptAt: sql`clock_timestamp()`,
            closedAt: state === "pending" ? null : sql`clock_timestamp()`,
            failureCode: state === "pending" ? "capture_unavailable" : null,
            suppressedReason:
              state === "suppressed" ? "outdated_or_unauthorized" : null,
          })
          .where(identity);
        await client.query("COMMIT");
        if (state === "captured") result.captured++;
        else if (state === "suppressed") result.suppressed++;
        else result.retryable++;
      } catch {
        // Filesystem publication may already have happened. Pending state plus
        // stable file key permits a safe manual retry; no success is reported.
        await client.query("ROLLBACK");
        result.retryable++;
      }
    }
    return result;
  } catch {
    throw new Error("Local notice dispatch unavailable; details omitted.");
  } finally {
    client.release();
  }
}
