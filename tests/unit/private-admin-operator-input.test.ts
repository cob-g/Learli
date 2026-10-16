import { describe, expect, it } from "vitest";
import { privateWorkflowOperatorInput } from "@/features/private-workflow/operator";

const grant = {
  action: "grant-account",
  apply: true,
  reviewerEmail: "admin@learli.test",
  targetId: "fictional-student-1",
} as const;

describe("explicit single-target private account metadata command", () => {
  it("accepts a single account target without any domain mutation fields", () => {
    expect(privateWorkflowOperatorInput.parse(grant)).toEqual(grant);
  });

  it.each([
    { ...grant, targetId: undefined },
    { ...grant, targetId: "a/b" },
    { ...grant, targetId: "x".repeat(129) },
    { ...grant, reviewerEmail: "admin@example.com" },
    { ...grant, apply: false },
    { ...grant, targetIds: ["fictional-student-1"] },
    { ...grant, role: "admin" },
    { ...grant, status: "active" },
    { ...grant, validUntil: "2026-10-17T00:00:00Z" },
  ])("rejects absent, bulk or domain-mutation authority", (input) => {
    expect(privateWorkflowOperatorInput.safeParse(input).success).toBe(false);
  });
});
