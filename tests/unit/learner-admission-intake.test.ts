import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthRuntime } from "@/lib/auth-factory";
import { AccessError } from "@/lib/permissions/access";
import { localAdmissionPolicy } from "@/features/learner-admission/policy";
import { handleAdmissionRequest } from "@/features/learner-admission/handler";

const reads = vi.hoisted(() => ({
  local: vi.fn(),
  intake: vi.fn(),
  create: vi.fn(),
  detail: vi.fn(),
  review: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/features/local-workflow/runtime", () => ({
  getLocalWorkflow: reads.local,
}));
vi.mock("@/features/learner-admission/context", () => ({
  admissionContext: vi.fn(),
}));
vi.mock("@/features/learner-admission/service", () => ({
  readAdmissionIntake: reads.intake,
  createAdmission: reads.create,
  readMyAdmission: reads.detail,
  listMyAdmissions: vi.fn(),
  readAssignedAdmission: vi.fn(),
  listAssignedAdmissions: vi.fn(),
  mutateAdmissionReview: reads.review,
}));

const runtime = { origin: "http://127.0.0.1:3000" } as AuthRuntime;
const context = { runtime, admission: localAdmissionPolicy };
const input = {
  requestId: "ec537f61-bcf7-429a-8589-8d1fe9368128",
  policyVersion: localAdmissionPolicy.version,
  policyDigest: localAdmissionPolicy.contentDigest,
  management: "self",
  displayName: "Independent learner",
  level: "college_support",
  timezone: "Asia/Manila",
};
function request(body?: unknown) {
  return new Request(`${runtime.origin}/api/learner-admission`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      origin: runtime.origin,
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  reads.local.mockReturnValue({});
  reads.intake.mockResolvedValue({ enabled: true });
  reads.create.mockResolvedValue({ id: "created" });
});

describe("ordinary legacy admission HTTP intake", () => {
  it.each([
    ["self", "/student/onboarding"],
    ["guardian", "Add Child"],
  ])(
    "refuses new ordinary %s requests before invoking the legacy writer",
    async (management, destination) => {
      const response = await handleAdmissionRequest(
        runtime,
        request({ ...input, management }),
        undefined,
        undefined,
        context,
      );
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        message: expect.stringContaining(destination),
      });
      expect(reads.intake).toHaveBeenCalledOnce();
      expect(reads.create).not.toHaveBeenCalled();
    },
  );

  it("still checks authenticated intake before parsing or returning setup guidance", async () => {
    reads.intake.mockRejectedValue(new AccessError(403));
    const response = await handleAdmissionRequest(
      runtime,
      request(input),
      undefined,
      undefined,
      context,
    );
    expect(response.status).toBe(403);
    expect(reads.create).not.toHaveBeenCalled();
  });

  it("retains synthetic readiness intake outside the ordinary local workflow", async () => {
    reads.local.mockReturnValue(null);
    const response = await handleAdmissionRequest(
      runtime,
      request(input),
      undefined,
      undefined,
      context,
    );
    expect(response.status).toBe(200);
    expect(reads.create).toHaveBeenCalledWith(
      context,
      expect.any(Headers),
      input,
    );
  });

  it("preserves actual historical requester reads and assigned review writes", async () => {
    reads.detail.mockResolvedValue({ id: "historical", state: "pending" });
    const response = await handleAdmissionRequest(
      runtime,
      request(),
      "historical",
      undefined,
      context,
    );
    expect(response.status).toBe(200);
    expect(reads.detail).toHaveBeenCalledWith(
      context,
      expect.any(Headers),
      "historical",
    );
    reads.review.mockResolvedValue({ id: "historical", state: "authorized" });
    const decision = {
      action: "authorize",
      revision: 0,
      requestId: input.requestId,
    };
    const reviewed = await handleAdmissionRequest(
      runtime,
      request(decision),
      "historical",
      "decision",
      context,
    );
    expect(reviewed.status).toBe(200);
    expect(reads.review).toHaveBeenCalledWith(
      context,
      expect.any(Headers),
      "historical",
      "decision",
      decision,
    );
    expect(reads.intake).not.toHaveBeenCalled();
    expect(reads.create).not.toHaveBeenCalled();
  });
});
