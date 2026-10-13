import type { TransportResult } from "@/lib/email/resend-transport";

// Technical workload bounds, not booking or customer retry policy.
export const DELIVERY_MAX_ATTEMPTS = 8;
export const DELIVERY_CLAIM_MS = 60_000;
export const PROVIDER_KEY_RETENTION_MS = 24 * 60 * 60 * 1000;
export type DeliveryFailure =
  | "rate_limited"
  | "unavailable"
  | "timeout"
  | "configuration"
  | "recipient"
  | "payload"
  | "retention_elapsed"
  | "attempt_limit";
export type DeliveryOutcome =
  | {
      state: "provider_accepted";
      providerId: string;
      failureCode: null;
      nextAttemptAt: null;
    }
  | {
      state: "retryable" | "uncertain";
      providerId: null;
      failureCode: DeliveryFailure;
      nextAttemptAt: number;
    }
  | {
      state: "blocked";
      providerId: null;
      failureCode: DeliveryFailure;
      nextAttemptAt: null;
    };

export function retryGate(
  firstAttemptAt: number,
  attempts: number,
  now: number,
) {
  if (
    ![firstAttemptAt, attempts, now].every(Number.isSafeInteger) ||
    firstAttemptAt < 0 ||
    now < firstAttemptAt ||
    attempts < 1
  )
    throw new Error("Invalid delivery attempt state.");
  if (now - firstAttemptAt >= PROVIDER_KEY_RETENTION_MS)
    return "retention_elapsed" as const;
  if (attempts >= DELIVERY_MAX_ATTEMPTS) return "attempt_limit" as const;
  return null;
}

/** First attempt is durable before send; ACK failure never resets that identity. */
export function deliveryOutcome(
  result: TransportResult,
  firstAttemptAt: number,
  attempts: number,
  now: number,
): DeliveryOutcome {
  // An observed accepted response closes even at a retention boundary. It is not delivery.
  if (result.status === "accepted")
    return {
      state: "provider_accepted",
      providerId: result.providerId,
      failureCode: null,
      nextAttemptAt: null,
    };
  const refusal = retryGate(firstAttemptAt, attempts, now);
  if (refusal)
    return {
      state: "blocked",
      providerId: null,
      failureCode: refusal,
      nextAttemptAt: null,
    };
  if (result.status === "rejected")
    return {
      state: "blocked",
      providerId: null,
      failureCode: result.code,
      nextAttemptAt: null,
    };
  const nextAttemptAt = Math.min(
    now + Math.min(5_000 * 2 ** (attempts - 1), 15 * 60_000),
    firstAttemptAt + PROVIDER_KEY_RETENTION_MS,
  );
  return {
    state: result.status === "uncertain" ? "uncertain" : "retryable",
    providerId: null,
    failureCode: result.code,
    nextAttemptAt,
  };
}
