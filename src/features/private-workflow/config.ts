// Node-only policy admission, shared with operator tooling and isolated unit tests.
import { z } from "zod";
import { isLoopbackOrigin, syntheticEmail } from "@/lib/local-mode";
import { hostedOrigin } from "@/features/hosted-auth/config";
import { validateAdmissionCapability } from "@/features/learner-admission/policy";
import { validateScreeningCapability } from "@/features/tutor-screening/policy";
import { validateBookingCapability } from "@/features/booking-workflows/policy";

export class PrivateWorkflowError extends Error {
  constructor() {
    super("Private workflow configuration is unavailable. Details omitted.");
  }
}

const accountEmails = z
  .array(
    z
      .email()
      .max(254)
      .refine(
        (value) => value === value.toLowerCase() && syntheticEmail(value),
      ),
  )
  .min(1)
  .max(100)
  .refine((values) => new Set(values).size === values.length);
const resourceId = z.string().regex(/^[a-z0-9][a-z0-9_-]{1,127}$/);
const localDatabase = z.strictObject({
  mode: z.literal("local-test"),
  host: z.enum(["127.0.0.1", "localhost", "::1"]),
  port: z.number().int().min(1).max(65535),
  database: z.literal("learli_test"),
  runtimeRole: z.literal("learli_app"),
});
const hostedDatabase = z.strictObject({
  mode: z.literal("hosted-staging"),
  projectId: resourceId,
  branchId: resourceId.refine((value) => value.startsWith("br-")),
  endpointId: resourceId.refine((value) => value.startsWith("ep-")),
  database: z
    .string()
    .regex(/^[a-z_][a-z0-9_]{0,62}$/)
    .refine(
      (value) =>
        ![
          "learli_dev",
          "learli_test",
          "postgres",
          "template0",
          "template1",
        ].includes(value) && !/(^|_)(prod|production)(_|$)/.test(value),
    ),
});
const database = z.discriminatedUnion("mode", [localDatabase, hostedDatabase]);
const packet = z.strictObject({
  version: z.literal(1),
  purpose: z.literal("private_fictional_workflow"),
  audience: z.literal("fictional_only"),
  realIntake: z.literal("disabled"),
  payments: z.literal("disabled"),
  origin: z.string().max(2048),
  accountEmails,
  database,
  admission: z.unknown(),
  screening: z.unknown(),
  booking: z.unknown(),
});

export type PrivateWorkflowDatabase = z.infer<typeof database>;
export type PrivateWorkflowBinding = { origin: string } & (
  | { database: z.infer<typeof localDatabase>; accountEmails?: never }
  | {
      database: z.infer<typeof hostedDatabase>;
      accountEmails: readonly string[];
    }
);

/** Pure validation binds receipts to an explicit expected runtime, never to an env flag. */
export function parsePrivateWorkflow(
  input: unknown,
  expected: PrivateWorkflowBinding,
) {
  try {
    const value = packet.parse(input);
    const target = database.parse(expected.database);
    const origin = new URL(value.origin);
    if (
      origin.origin !== value.origin ||
      !(target.mode === "local-test"
        ? isLoopbackOrigin(value.origin)
        : hostedOrigin(value.origin)) ||
      value.origin !== expected.origin ||
      JSON.stringify(value.database) !== JSON.stringify(target)
    )
      throw new Error();
    const emails = [...value.accountEmails].sort();
    if (
      target.mode === "hosted-staging" &&
      JSON.stringify(emails) !==
        JSON.stringify(accountEmails.parse(expected.accountEmails).sort())
    )
      throw new Error();

    const admission = validateAdmissionCapability(value.admission);
    const screening = validateScreeningCapability(value.screening, "test");
    const booking = validateBookingCapability(value.booking, "test");
    if (
      admission.authority !== "synthetic_test" ||
      screening.mode !== "synthetic_test" ||
      booking.authority === "disabled" ||
      booking.version !== "synthetic-booking-v2" ||
      booking.completionActor !== "assigned_tutor" ||
      booking.admissionPolicyId !== admission.policyId
    )
      throw new Error();
    Object.freeze(screening.requiredCheckCodes);
    Object.freeze(screening.allowedActions);
    return Object.freeze({
      ...value,
      database: Object.freeze(value.database),
      accountEmails: Object.freeze(emails),
      admission,
      screening,
      booking,
    });
  } catch {
    throw new PrivateWorkflowError();
  }
}

export type PrivateWorkflowPacket = ReturnType<typeof parsePrivateWorkflow>;
