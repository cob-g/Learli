import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AccessError } from "@/lib/permissions/access";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ getAuthRuntime: () => ({}) }));
vi.mock("@/features/support/service", () => ({
  listCases: async () => {
    throw new AccessError(401);
  },
}));
vi.mock("@/features/support-bookings/service", () => ({
  readBookingForReport: async () => undefined,
}));
vi.mock("@/features/support/case-form", () => ({ CaseForm: () => null }));
vi.mock("@/features/support/presentation", () => ({
  DemoNotice: () => null,
}));
vi.mock("@/features/support-bookings/presentation", () => ({
  SupportBookingSection: () => null,
}));

import { SupportEntry } from "@/features/support/entry";

const id = "4f1b2c3d-1111-4222-8333-444455556666";
const signIn = async (props: Parameters<typeof SupportEntry>[0]) =>
  /href="(\/sign-in[^"]*)"/.exec(
    renderToStaticMarkup(await SupportEntry(props)),
  )?.[1];

describe("support sign-in link", () => {
  it("keeps a valid booking id in the return path", async () => {
    expect(await signIn({ bookingId: id })).toBe(
      `/sign-in?next=${encodeURIComponent(`/contact?bookingId=${id}`)}`,
    );
    expect(await signIn({ concern: true, bookingId: id })).toContain(
      encodeURIComponent("/report-a-concern?bookingId="),
    );
  });
  it("drops an invalid booking id", async () => {
    expect(await signIn({ bookingId: "nope" })).toBe(
      "/sign-in?next=%2Fcontact",
    );
    expect(await signIn({})).toBe("/sign-in?next=%2Fcontact");
  });
});
