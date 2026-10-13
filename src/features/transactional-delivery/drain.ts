import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/connection";
import { transactionalDeliveries as deliveries } from "@/lib/db/schema/transactional-delivery";
import {
  bookingMessageInput,
  type BookingMessageInput,
  type ValidatedMessage,
} from "@/lib/email/transactional-message";
import { assertDeliveryContext, type DeliveryContext } from "./context";
import { currentDeliveryMaterial } from "./recipient";
import { DELIVERY_CLAIM_MS, deliveryOutcome, retryGate } from "./state";

const optionsSchema = z.strictObject({
  limit: z.number().int().min(1).max(25).default(25),
  eventId: z.uuid().optional(),
});
export type DrainOptions = z.input<typeof optionsSchema>;
export type DrainCounts = {
  providerAccepted: number;
  retryable: number;
  uncertain: number;
  suppressed: number;
  blocked: number;
  skipped: number;
  unavailable: number;
};
const candidatesWhere = () =>
  or(
    eq(deliveries.state, "pending"),
    and(
      sql`${deliveries.state} IN ('retryable','uncertain')`,
      sql`${deliveries.nextAttemptAt} <= clock_timestamp()`,
    ),
    and(
      eq(deliveries.state, "claimed"),
      sql`${deliveries.claimUntil} <= clock_timestamp()`,
    ),
  );
async function clock(db: Pick<Database, "execute">) {
  const r = await db.execute<{ milliseconds: number }>(
    sql`SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::float8 AS milliseconds`,
  );
  return new Date(r.rows[0].milliseconds);
}
type Preparation =
  | { closed: "blocked" | "suppressed" | "skipped" }
  | {
      ready: {
        row: typeof deliveries.$inferSelect;
        token: string;
        firstAttemptAt: Date;
        attempts: number;
        payload: BookingMessageInput;
        message: ValidatedMessage;
      };
    };

/** Independent post-commit owner drain. Its Database is a separate operator
 * runtime, never a booking transaction. W2's guarded query/connect leases remain
 * behind the accepted Drizzle boundary; no native Pool or compatibility cast. */
export async function drainTransactionalDeliveries(
  context: DeliveryContext,
  input: DrainOptions = {},
): Promise<DrainCounts> {
  assertDeliveryContext(context);
  const options = optionsSchema.parse(input),
    db = context.db;
  const result: DrainCounts = {
    providerAccepted: 0,
    retryable: 0,
    uncertain: 0,
    suppressed: 0,
    blocked: 0,
    skipped: 0,
    unavailable: 0,
  };
  try {
    // One bounded candidate snapshot; each identity is attempted once per call.
    const candidates = await db
      .select({ id: deliveries.id })
      .from(deliveries)
      .where(
        and(
          candidatesWhere(),
          options.eventId ? eq(deliveries.eventId, options.eventId) : undefined,
        ),
      )
      .orderBy(asc(deliveries.createdAt), asc(deliveries.id))
      .limit(options.limit);
    for (const candidate of candidates) {
      let attempted = false;
      try {
        const preparation: Preparation = await db.transaction(
          async (tx): Promise<Preparation> => {
            const [row] = await tx
              .select()
              .from(deliveries)
              .where(and(eq(deliveries.id, candidate.id), candidatesWhere()))
              .for("update", { skipLocked: true });
            if (!row) return { closed: "skipped" };
            const now = await clock(tx),
              token = randomUUID();
            const identity = and(
              eq(deliveries.id, row.id),
              eq(deliveries.state, "claimed"),
              eq(deliveries.claimToken, token),
            );
            await tx
              .update(deliveries)
              .set({
                state: "claimed",
                claimToken: token,
                claimUntil: new Date(now.getTime() + DELIVERY_CLAIM_MS),
                nextAttemptAt: null,
                failureCode: null,
              })
              .where(eq(deliveries.id, row.id));
            const close = async (
              state: "blocked" | "suppressed",
              value: {
                suppressedReason?:
                  "outdated_or_unauthorized" | "material_changed";
                failureCode?:
                  | "retention_elapsed"
                  | "attempt_limit"
                  | "configuration"
                  | "payload";
              },
            ): Promise<Preparation> => {
              await tx
                .update(deliveries)
                .set({
                  state,
                  claimToken: null,
                  claimUntil: null,
                  closedAt: await clock(tx),
                  ...value,
                })
                .where(identity);
              return { closed: state };
            };
            if (row.firstAttemptAt) {
              const refusal = retryGate(
                row.firstAttemptAt.getTime(),
                row.attempts,
                now.getTime(),
              );
              if (refusal) return close("blocked", { failureCode: refusal });
              if (
                row.configurationFingerprint !==
                context.configurationFingerprint
              )
                return close("blocked", { failureCode: "configuration" });
            }
            const firstAttemptAt = row.firstAttemptAt ?? now;
            const fresh = await currentDeliveryMaterial(
              tx,
              row.eventId,
              row.recipientUserId,
              row.kind,
              firstAttemptAt.getTime(),
            );
            if (!fresh)
              return close("suppressed", {
                suppressedReason: "outdated_or_unauthorized",
              });
            const stored = row.payload
              ? bookingMessageInput.safeParse(row.payload)
              : null;
            if (
              stored &&
              (!stored.success ||
                JSON.stringify(stored.data) !== JSON.stringify(fresh))
            )
              return close("suppressed", {
                suppressedReason: "material_changed",
              });
            const payload = stored?.success ? stored.data : fresh,
              prepared = context.construct(payload);
            if (
              !prepared.ok ||
              (row.payload &&
                (prepared.message.idempotencyKey !== row.idempotencyKey ||
                  prepared.message.payloadFingerprint !==
                    row.payloadFingerprint))
            )
              return close("blocked", { failureCode: "payload" });
            const attempts = row.attempts + 1;
            await tx
              .update(deliveries)
              .set({
                payload,
                idempotencyKey: prepared.message.idempotencyKey,
                payloadFingerprint: prepared.message.payloadFingerprint,
                configurationFingerprint: context.configurationFingerprint,
                firstAttemptAt,
                lastAttemptAt: now,
                attempts,
              })
              .where(identity);
            // The driver's transaction commits before this value reaches SDK send.
            return {
              ready: {
                row,
                token,
                firstAttemptAt,
                attempts,
                payload,
                message: prepared.message,
              },
            };
          },
          { isolationLevel: "read committed" },
        );
        if ("closed" in preparation) {
          result[preparation.closed]++;
          continue;
        }
        const { row, token, firstAttemptAt, attempts, payload, message } =
          preparation.ready;
        const identity = and(
          eq(deliveries.id, row.id),
          eq(deliveries.state, "claimed"),
          eq(deliveries.claimToken, token),
          sql`${deliveries.claimUntil} > clock_timestamp()`,
        );
        // Independent fresh queries, with the preparation transaction already
        // committed and released. No domain/queue lock is held during SDK I/O.
        const sending = await currentDeliveryMaterial(
          db,
          row.eventId,
          row.recipientUserId,
          row.kind,
          firstAttemptAt.getTime(),
        );
        const [lease] = await db
          .select({ id: deliveries.id })
          .from(deliveries)
          .where(identity);
        if (!lease) {
          result.skipped++;
          continue;
        }
        if (!sending || JSON.stringify(sending) !== JSON.stringify(payload)) {
          const changed = await db
            .update(deliveries)
            .set({
              state: "suppressed",
              claimToken: null,
              claimUntil: null,
              closedAt: await clock(db),
              suppressedReason: sending
                ? "material_changed"
                : "outdated_or_unauthorized",
            })
            .where(identity)
            .returning({ id: deliveries.id });
          if (changed.length) result.suppressed++;
          else result.skipped++;
          continue;
        }
        attempted = true;
        const provider = await context.transport.send(message);
        const outcome = deliveryOutcome(
          provider,
          firstAttemptAt.getTime(),
          attempts,
          (await clock(db)).getTime(),
        );
        const changed = await db
          .update(deliveries)
          .set({
            state: outcome.state,
            claimToken: null,
            claimUntil: null,
            failureCode: outcome.failureCode,
            providerId: outcome.providerId,
            nextAttemptAt:
              outcome.nextAttemptAt === null
                ? null
                : new Date(outcome.nextAttemptAt),
            closedAt:
              outcome.state === "blocked" ||
              outcome.state === "provider_accepted"
                ? await clock(db)
                : null,
          })
          .where(identity)
          .returning({ id: deliveries.id });
        if (!changed.length) result.uncertain++;
        else if (outcome.state === "provider_accepted")
          result.providerAccepted++;
        else result[outcome.state]++;
      } catch {
        // Transaction/ACK errors never reset the durable possible-send identity.
        // If API acceptance happened, the unacknowledged claim remains uncertain.
        if (attempted) result.uncertain++;
        else result.unavailable++;
      }
    }
    return result;
  } catch {
    throw new Error("Transactional delivery unavailable. Details omitted.");
  }
}
