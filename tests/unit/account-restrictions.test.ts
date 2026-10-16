import { describe, expect, it } from "vitest";
import {
  changeInput,
  targetIdInput,
  pageInput,
  privateAccountQueryInput,
  accountQueryFromSearch,
  accountSearchParams,
  accountListHref,
  accountTargetHref,
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
  it("bounds private literal name/role/status/paging filters without accepting authority fields", () => {
    expect(
      privateAccountQueryInput.parse({
        q: "  A_%  ",
        role: "tutor",
        status: "suspended",
        pageSize: "2",
      }),
    ).toEqual({
      q: "A_%",
      role: "tutor",
      status: "suspended",
      page: 1,
      pageSize: 2,
    });
    for (const input of [
      { q: "x".repeat(101) },
      { q: ["one", "two"] },
      { role: "admin" },
      { status: "deleted" },
      { pageSize: 0 },
      { pageSize: 21 },
      { pageSize: 1.5 },
      { actorUserId: "forged" },
      { next: "https://unrelated.test" },
    ])
      expect(privateAccountQueryInput.safeParse(input).success).toBe(false);
  });
  it("rejects unknown and duplicate query fields, with distinct bounded detail history paging", () => {
    for (const search of [
      "q=one&q=two",
      "page=1&page=1",
      "role=student&role=tutor",
      "targetId=foreign",
      "historyPage=2",
    ])
      expect(() =>
        accountQueryFromSearch(new URLSearchParams(search)),
      ).toThrow();
    expect(() =>
      accountQueryFromSearch(accountSearchParams({ q: ["one", "two"] })),
    ).toThrow();
    expect(
      accountQueryFromSearch(
        new URLSearchParams("page=2&historyPage=3&pageSize=2"),
        true,
      ),
    ).toMatchObject({ page: 2, historyPage: 3, pageSize: 2 });
    expect(() =>
      accountQueryFromSearch(new URLSearchParams("historyPage=1001"), true),
    ).toThrow();
  });
  it("keeps exact list filters and page on detail/back/history navigation without a return URL", () => {
    const query = privateAccountQueryInput.parse({
      q: "A_%",
      role: "student",
      status: "active",
      page: 2,
      pageSize: 2,
    });
    expect(accountListHref(query)).toBe(
      "/admin/accounts?q=A_%25&role=student&status=active&page=2&pageSize=2",
    );
    expect(accountListHref(query, 1)).not.toContain("page=2");
    const detail = new URL(
      accountTargetHref("opaque-account", query, 3),
      "http://learli.invalid",
    );
    expect(detail.pathname).toBe("/admin/accounts/opaque-account");
    expect(detail.searchParams.get("page")).toBe("2");
    expect(detail.searchParams.get("historyPage")).toBe("3");
    const parsed = accountQueryFromSearch(detail.searchParams, true);
    expect(accountListHref(parsed)).toBe(accountListHref(query));
    expect(accountListHref(privateAccountQueryInput.parse({}))).toBe(
      "/admin/accounts",
    );
  });
});
