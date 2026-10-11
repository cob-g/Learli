import { describe, expect, it } from "vitest";
import {
  changeInput,
  targetIdInput,
  pageInput,
} from "@/features/account-restrictions/input";
const input = {
  revision: 0,
  status: "suspended",
  reason: "local_access_test",
  requestKey: "947182f7-1e69-4ebc-bb46-671e19a3f6db",
};
describe("untrusted account restriction input", () => {
  it("accepts bounded suspend/restore reasons only in the correct direction", () => {
    expect(changeInput.safeParse(input).success).toBe(true);
    expect(
      changeInput.safeParse({
        ...input,
        status: "active",
        reason: "local_restore_test",
      }).success,
    ).toBe(true);
    for (const change of [
      { status: "active" },
      { reason: "local_restore_test" },
      { reason: "misconduct" },
      { revision: -1 },
      { revision: 2147483647 },
      { revision: 1.5 },
      { requestKey: "not-a-key" },
    ])
      expect(changeInput.safeParse({ ...input, ...change }).success).toBe(
        false,
      );
  });
  it("rejects forged authority and free-form notes", () => {
    for (const key of [
      "actorUserId",
      "sessionId",
      "targetUserId",
      "role",
      "note",
      "source",
    ])
      expect(changeInput.safeParse({ ...input, [key]: "forged" }).success).toBe(
        false,
      );
  });
  it("bounds routes and read pages", () => {
    for (const id of ["../admin", "x".repeat(129), "", "foo/bar"])
      expect(targetIdInput.safeParse(id).success).toBe(false);
    expect(targetIdInput.safeParse("opaque_provider-id_123").success).toBe(
      true,
    );
    for (const page of [0, 1001, "NaN"])
      expect(pageInput.safeParse(page).success).toBe(false);
  });
});
