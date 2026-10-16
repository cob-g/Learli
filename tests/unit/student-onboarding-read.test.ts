import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthRuntime } from "@/lib/auth-factory";
import {
  readStudentOnboarding,
  canOpenStudentWorkspace,
} from "@/features/student-onboarding/read";
const reads = vi.hoisted(() => ({
  context: vi.fn(),
  intake: vi.fn(),
  list: vi.fn(),
  groups: vi.fn(),
}));
vi.mock("@/features/learner-admission/context", () => ({
  admissionContext: reads.context,
}));
vi.mock("@/features/learner-admission/service", () => ({
  readAdmissionIntake: reads.intake,
  listMyAdmissions: reads.list,
}));
vi.mock("@/features/learners/composition", () => ({
  listLearnerGroups: reads.groups,
}));
const runtime = {} as AuthRuntime,
  headers = new Headers();
beforeEach(() => {
  vi.resetAllMocks();
  reads.context.mockReturnValue({
    runtime,
    admission: { authority: "synthetic_test" },
  });
  reads.intake.mockResolvedValue({ enabled: true });
  reads.list.mockResolvedValue({ items: [], nextCursor: null });
  reads.groups.mockResolvedValue({ demo: [], readiness: [] });
});
describe("College Student setup authorized read composition", () => {
  it("keeps default admission disabled and asks the identity-checked intake service before continuing", async () => {
    reads.context.mockReturnValue({
      runtime,
      admission: { authority: "disabled" },
    });
    reads.intake.mockResolvedValue({ enabled: false });
    expect(await readStudentOnboarding(runtime, headers)).toEqual({
      enabled: false,
      admissionId: null,
    });
    expect(reads.intake).toHaveBeenCalledWith(
      { runtime, admission: { authority: "disabled" } },
      headers,
    );
    expect(reads.list).not.toHaveBeenCalled();
  });
  it("offers intake to a fresh roleless account through existing reads only", async () => {
    expect(await readStudentOnboarding(runtime, headers)).toEqual({
      enabled: true,
      admissionId: null,
    });
    expect(reads.list).toHaveBeenCalledWith(
      reads.context.mock.results[0].value,
      headers,
      null,
    );
  });
  it.each(["pending", "authorized", "rejected", "revoked"])(
    "reopens an existing own self request in state %s, including when new intake is paused",
    async (state) => {
      reads.intake.mockResolvedValue({ enabled: false });
      reads.list.mockResolvedValue({
        items: [{ id: "own-self", management: "self", state }],
        nextCursor: null,
      });
      expect(await readStudentOnboarding(runtime, headers)).toEqual({
        enabled: false,
        admissionId: "own-self",
      });
    },
  );
  it("finds self admission behind the twenty retained guardian requests and fails closed on unexpected overflow", async () => {
    reads.list
      .mockResolvedValueOnce({
        items: Array.from({ length: 20 }, () => ({ management: "guardian" })),
        nextCursor: "own-cursor",
      })
      .mockResolvedValueOnce({
        items: [{ id: "own-self", management: "self" }],
        nextCursor: null,
      });
    expect((await readStudentOnboarding(runtime, headers)).admissionId).toBe(
      "own-self",
    );
    expect(reads.list).toHaveBeenLastCalledWith(
      reads.context.mock.results[0].value,
      headers,
      "own-cursor",
    );
    reads.list.mockReset().mockResolvedValue({
      items: [{ management: "guardian" }],
      nextCursor: "unexpected-overflow",
    });
    await expect(readStudentOnboarding(runtime, headers)).rejects.toMatchObject(
      { status: 503 },
    );
    expect(reads.list).toHaveBeenCalledTimes(2);
  });
  it.each(["demo", "readiness"])(
    "advertises Student only with a currently authorized own College profile from %s",
    async (source) => {
      reads.groups.mockResolvedValue({
        demo: [],
        readiness: [],
        [source]: [{ management: "self", level: "college_support" }],
      });
      expect(await canOpenStudentWorkspace(runtime, headers)).toBe(true);
      reads.groups.mockResolvedValue({
        demo: [{ management: "guardian", level: "college_support" }],
        readiness: [],
      });
      expect(await canOpenStudentWorkspace(runtime, headers)).toBe(false);
      reads.groups.mockResolvedValue({ demo: [], readiness: [] });
      expect(await canOpenStudentWorkspace(runtime, headers)).toBe(false);
    },
  );
});
