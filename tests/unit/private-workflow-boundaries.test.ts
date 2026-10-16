import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthRuntime } from "@/lib/auth-factory";
import type { HostedAuthConfig } from "@/features/hosted-auth/config";

vi.mock("server-only", () => ({}));
const factories = vi.hoisted(() => ({
  local: vi.fn(),
  hosted: vi.fn(),
  database: vi.fn(),
}));
vi.mock("@/lib/auth-factory", () => ({ createLocalAuth: factories.local }));
vi.mock("@/features/hosted-auth/factory", () => ({
  createHostedAuth: factories.hosted,
}));
vi.mock("@/lib/db/hosted-runtime", () => ({
  createHostedRuntimeDatabase: factories.database,
}));

import { getAccountAuthRuntime, getDomainAuthRuntime } from "@/lib/auth";
import {
  sameAccountOrigin,
  sameDomainOrigin,
  sameLocalOrigin,
} from "@/lib/auth-handler";
import { permitsAccountEmail } from "@/features/hosted-auth/request";
import { admissionContext } from "@/features/learner-admission/context";
import { getScreeningContext } from "@/features/tutor-screening/composition";
import { bookingWorkflowContext } from "@/features/booking-workflows/composition";
import {
  bookingPolicyDigest,
  validateBookingCapability,
} from "@/features/booking-workflows/policy";
import { privatePolicyEnvironment } from "@/features/private-workflow/runtime";
import { PrivateWorkflowError } from "@/features/private-workflow/config";
import { parseHostedAuthConfig } from "@/features/hosted-auth/config";
import { drainHostedTransactionalDelivery } from "@/features/transactional-delivery/operator";
import { syntheticAdmissionPolicy } from "../support/learner-admission-fixtures";
import {
  hostedTestPacket,
  hostedTestSource,
} from "../support/hosted-auth-packet";

const emails = [
  "parent@example.test",
  "tutor@example.test",
  "admin@example.test",
];
const localOrigin = "http://127.0.0.1:3100";
const localTarget = {
  mode: "local-test",
  host: "127.0.0.1",
  port: 55432,
  database: "learli_test",
  runtimeRole: "learli_app",
} as const;
const shared = globalThis as typeof globalThis & Record<string, unknown>;
const globals = [
  "learliAuth",
  "learliHostedAuth",
  "learliAccountMode",
  "learliDatabaseMode",
  "learliCloseAccountAuth",
];
const roots: string[] = [];
afterEach(() => {
  for (const key of globals) delete shared[key];
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function policyPacket(origin: string, database: unknown) {
  const admission = syntheticAdmissionPolicy(randomUUID());
  const terms = {
    authority: "synthetic_test",
    source: "synthetic_readiness",
    version: "synthetic-booking-v2",
    reference: "synthetic:booking:v2",
    admissionPolicyId: admission.policyId,
    durationMinutes: 60,
    stepMinutes: 30,
    noticeMinutes: 60,
    horizonDays: 14,
    provisionalMinutes: 10,
    cancelCutoffMinutes: 60,
    moveCutoffMinutes: 60,
    confirmationPrerequisite: "synthetic_prerequisite_review",
    confirmationActor: "assigned_mfa_admin",
    outcomeActor: "assigned_mfa_admin",
    disputePath: "/support",
    meetingAccess: "confirmed_until_end",
    completionActor: "assigned_tutor",
  } as const;
  return {
    version: 1,
    purpose: "private_fictional_workflow",
    audience: "fictional_only",
    realIntake: "disabled",
    payments: "disabled",
    origin,
    database,
    accountEmails: emails,
    admission,
    screening: {
      mode: "synthetic_test",
      provenance: "synthetic_readiness",
      version: "fictional-boundaries-v1",
      reference: `policy:${randomUUID()}`,
      authorityReference: `synthetic:${randomUUID()}`,
      validFrom: "2026-10-01T00:00:00Z",
      validUntil: "2026-11-01T00:00:00Z",
      requiredCheckCodes: ["fictional_identity", "fictional_safeguarding"],
      allowedActions: ["approve", "revoke"],
      expiryRule: "all_checks_current",
    },
    booking: {
      ...terms,
      policyId: randomUUID(),
      contentDigest: bookingPolicyDigest(terms),
    },
  };
}

function fixture(mode: "local" | "hosted" = "hosted") {
  const root = mkdtempSync(path.join(os.tmpdir(), "learli-workflow-boundary-"));
  roots.push(root);
  const directory = path.join(root, ".local");
  mkdirSync(directory, { mode: 0o700 });
  const hostedFile = path.join(directory, "hosted.json");
  const workflowFile = path.join(directory, "workflow.json");
  const source: Record<string, string | undefined> =
    mode === "hosted"
      ? { ...hostedTestSource(), HOSTED_AUTH_CONFIG_FILE: hostedFile }
      : {
          APP_ENV: "test",
          AUTH_MODE: "local",
          APP_URL: localOrigin,
          DATABASE_URL:
            "postgresql://learli_app:fictional-unit-credential@127.0.0.1:55432/learli_test",
          BETTER_AUTH_SECRET: "fictional-boundary-auth-secret-for-unit-tests",
        };
  for (const key of [
    ...Object.keys(source),
    "DATABASE_MODE",
    "DATABASE_URL",
    "DATABASE_URL_DIRECT",
    "NEON_DEVELOPMENT_CONFIG_FILE",
    "HOSTED_AUTH_CONFIG_FILE",
    "HOSTED_INGRESS_SECRET",
    "BETTER_AUTH_URL",
    "BETTER_AUTH_SECRETS",
    "PRIVATE_WORKFLOW_CONFIG_FILE",
    "RESEND_API_KEY",
    "EMAIL_FROM",
  ])
    vi.stubEnv(key, source[key]);
  vi.spyOn(process, "cwd").mockReturnValue(root);
  const hostedPacket = hostedTestPacket(emails);
  writeFileSync(hostedFile, JSON.stringify(hostedPacket), { mode: 0o600 });
  const config = parseHostedAuthConfig(hostedTestSource(), hostedPacket);
  const target = config.database.target;
  const origin = mode === "hosted" ? config.origin : localOrigin;
  const database =
    mode === "hosted"
      ? {
          mode: "hosted-staging",
          projectId: target.projectId,
          branchId: target.branchId,
          endpointId: target.endpointId,
          database: target.database,
        }
      : localTarget;
  const packet = policyPacket(origin, database);
  const local = {
    origin,
    environment: "test",
    pool: {
      options: {
        host: localTarget.host,
        port: localTarget.port,
        database: localTarget.database,
        user: localTarget.runtimeRole,
      },
    },
  } as unknown as AuthRuntime;
  factories.local.mockReturnValue(local);
  factories.hosted.mockImplementation(async (hosted: HostedAuthConfig) => ({
    origin: hosted.origin,
    environment: "staging",
    hosted,
    close: async () => {},
  }));
  return {
    root,
    directory,
    config,
    packet,
    workflowFile,
    enable(value: unknown = packet) {
      writeFileSync(workflowFile, JSON.stringify(value), { mode: 0o600 });
      vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", workflowFile);
    },
  };
}
function mutation(
  runtime: AuthRuntime,
  overrides: Record<string, string> = {},
) {
  const hosted = "hosted" in runtime ? runtime.hosted : undefined;
  return new Request(`${runtime.origin}/api/learner-admission`, {
    method: "POST",
    headers: {
      host: new URL(runtime.origin).host,
      origin: runtime.origin,
      ...(hosted
        ? {
            "x-learli-ingress-host": new URL(runtime.origin).host,
            "x-learli-ingress-proto": "https",
            "x-learli-ingress-token": hosted.ingressSecret,
            "x-learli-client-ip": "127.0.0.1",
          }
        : {}),
      ...overrides,
    },
  });
}

describe("private workflow composition boundaries", () => {
  it("preserves local access and disabled policy defaults when no packet is selected", async () => {
    fixture("local");
    const runtime = await getDomainAuthRuntime();
    expect(runtime).toBe(await getAccountAuthRuntime());
    if (!runtime) throw new Error("Expected the existing local runtime.");
    expect(admissionContext(runtime).admission).toEqual({
      authority: "disabled",
    });
    expect(getScreeningContext(runtime).screening).toEqual({
      mode: "disabled",
    });
    expect(bookingWorkflowContext(runtime).booking).toEqual({
      authority: "disabled",
    });
    expect(permitsAccountEmail(runtime, "other@example.test")).toBe(true);
    expect(sameLocalOrigin(mutation(runtime), runtime)).toBe(true);
  });
  it("does not promote a hosted account runtime to domain authority without its private packet", async () => {
    const f = fixture();
    expect(await getDomainAuthRuntime()).toBeNull();
    expect(factories.hosted).not.toHaveBeenCalled();
    const runtime = await getAccountAuthRuntime();
    if (!runtime)
      throw new Error("Expected the separate hosted account runtime.");
    expect(await getDomainAuthRuntime()).toBeNull();
    expect(sameAccountOrigin(mutation(runtime), runtime)).toBe(true);
    expect(sameDomainOrigin(mutation(runtime), runtime)).toBe(false);
    expect(bookingWorkflowContext(runtime).booking).toEqual({
      authority: "disabled",
    });
    const environment = privatePolicyEnvironment(
      runtime,
      "booking",
      f.packet.booking,
    );
    expect(environment).toBe("staging");
    expect(() =>
      validateBookingCapability(f.packet.booking, environment),
    ).toThrow();
  });
  it.each(["local", "hosted"] as const)(
    "restricts active %s membership to the finite packet account set",
    async (mode) => {
      const f = fixture(mode);
      f.enable();
      const runtime = await getDomainAuthRuntime();
      if (!runtime)
        throw new Error("Expected the explicitly selected runtime.");
      expect(permitsAccountEmail(runtime, emails[0])).toBe(true);
      for (const email of [
        "other@example.test",
        "parent@example.com",
        emails[0].toUpperCase(),
      ])
        expect(permitsAccountEmail(runtime, email)).toBe(false);
    },
  );
  it("binds all policy contexts to the packet while retaining staging on foreign receipts", async () => {
    const f = fixture();
    f.enable();
    const runtime = await getDomainAuthRuntime();
    if (!runtime) throw new Error("Expected private hosted domain authority.");
    expect(admissionContext(runtime).admission).toEqual(f.packet.admission);
    expect(getScreeningContext(runtime).screening).toEqual(f.packet.screening);
    expect(bookingWorkflowContext(runtime).booking).toEqual(f.packet.booking);
    expect(privatePolicyEnvironment(runtime, "booking", f.packet.booking)).toBe(
      "test",
    );
    const foreign = { ...f.packet.booking, policyId: randomUUID() };
    expect(privatePolicyEnvironment(runtime, "booking", foreign)).toBe(
      "staging",
    );
    expect(() =>
      validateBookingCapability(foreign, runtime.environment),
    ).toThrow();
    expect(runtime.environment).toBe("staging");
  });
  it("denies invalidated or removed packets after the account singleton is already live", async () => {
    const f = fixture();
    f.enable();
    const runtime = await getDomainAuthRuntime();
    if (!runtime)
      throw new Error("Expected the initially valid private runtime.");
    f.enable({ ...f.packet, payments: "enabled" });
    await expect(getDomainAuthRuntime()).rejects.toThrow(PrivateWorkflowError);
    expect(() => bookingWorkflowContext(runtime)).toThrow(PrivateWorkflowError);
    expect(() => permitsAccountEmail(runtime, emails[0])).toThrow(
      PrivateWorkflowError,
    );
    rmSync(f.workflowFile);
    await expect(getDomainAuthRuntime()).rejects.toThrow(PrivateWorkflowError);
    vi.stubEnv("PRIVATE_WORKFLOW_CONFIG_FILE", undefined);
    expect(await getDomainAuthRuntime()).toBeNull();
    expect(factories.hosted).toHaveBeenCalledTimes(1);
  });
  it("retains signed hosted ingress and refuses foreign Origin, Host or envelope proof", async () => {
    const f = fixture();
    f.enable();
    const runtime = await getDomainAuthRuntime();
    if (!runtime) throw new Error("Expected private hosted domain authority.");
    expect(sameDomainOrigin(mutation(runtime), runtime)).toBe(true);
    expect(sameLocalOrigin(mutation(runtime), runtime)).toBe(false);
    const overrides: Record<string, string>[] = [
      { origin: "https://foreign.example.test" },
      { host: "foreign.example.test" },
      { "x-learli-ingress-token": "forged-proof" },
      { "x-learli-ingress-host": "foreign.example.test" },
      { "x-learli-ingress-proto": "http" },
    ];
    for (const override of overrides)
      expect(sameDomainOrigin(mutation(runtime, override), runtime)).toBe(
        false,
      );
  });
  it("preserves local mutation Origin checks even with the private packet active", async () => {
    const f = fixture("local");
    f.enable();
    const runtime = await getDomainAuthRuntime();
    if (!runtime) throw new Error("Expected private local test authority.");
    expect(sameDomainOrigin(mutation(runtime), runtime)).toBe(true);
    expect(
      sameDomainOrigin(
        mutation(runtime, {
          origin: "https://foreign.example.test",
          "x-forwarded-host": new URL(runtime.origin).host,
        }),
        runtime,
      ),
    ).toBe(false);
  });
  it("does not turn private account capture into Resend booking delivery or open its database", async () => {
    const f = fixture();
    const capture = parseHostedAuthConfig(hostedTestSource(), {
      ...hostedTestPacket(emails),
      mail: {
        mode: "private-capture",
        appOrigin: f.config.origin,
        directory: path.join(f.directory, "account-captures"),
      },
    });
    expect(await drainHostedTransactionalDelivery(capture)).toEqual({
      status: "disabled",
    });
    expect(factories.database).not.toHaveBeenCalled();
  });
});
