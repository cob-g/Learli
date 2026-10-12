import { describe, expect, it } from "vitest";
import { assignmentInput } from "@/features/support/dispatch-input";
const valid = {
  revision: 0,
  reviewerId: "synthetic-admin",
  kind: "assign",
  requestKey: "11111111-1111-4111-8111-111111111111",
};
describe("strict local assignment input", () => {
  it.each(["assign", "reassign", "escalate"])("accepts explicit %s", (kind) =>
    expect(assignmentInput.parse({ ...valid, kind }).kind).toBe(kind),
  );
  it.each([
    { revision: -1 },
    { revision: 0.5 },
    { revision: 2147483647 },
    { reviewerId: "" },
    { reviewerId: "x".repeat(129) },
    { reviewerId: "private@learli.test" },
    { kind: "close" },
    { requestKey: "bad" },
  ])("rejects invalid bounded mutation %o", (patch) =>
    expect(assignmentInput.safeParse({ ...valid, ...patch }).success).toBe(
      false,
    ),
  );
  it.each([
    "actorId",
    "caseId",
    "status",
    "source",
    "role",
    "body",
    "bookingId",
    "capability",
  ])("rejects unowned field %s", (key) =>
    expect(
      assignmentInput.safeParse({ ...valid, [key]: "forged" }).success,
    ).toBe(false),
  );
});
