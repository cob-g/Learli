import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  staffBookingHref,
  staffBookingInput,
  staffBookingsHref,
} from "@/features/booking-workflows/staff-input";

describe("assigned staff booking lookup input", () => {
  it("uses bounded defaults and an exact opaque booking ID, retaining all filters through navigation", () => {
    expect(staffBookingInput.parse({})).toEqual({
      state: "all",
      page: 1,
      pageSize: 20,
    });
    const id = randomUUID();
    const filters = staffBookingInput.parse({
      q: id,
      state: "cancelled",
      page: "2",
      pageSize: "1",
    });
    const next = new URL(
      staffBookingsHref(filters, 3),
      "http://learli.invalid",
    );
    expect(Object.fromEntries(next.searchParams)).toEqual({
      q: id,
      state: "cancelled",
      page: "3",
      pageSize: "1",
    });
    const detail = new URL(
      staffBookingHref(id, filters),
      "http://learli.invalid",
    );
    expect(detail.pathname).toBe(`/admin/bookings/${id}`);
    expect(Object.fromEntries(detail.searchParams)).toEqual({
      q: id,
      state: "cancelled",
      page: "2",
      pageSize: "1",
    });
    expect(staffBookingInput.parse({ q: "" }).q).toBeUndefined();
  });
  it.each([
    { q: "Fictional learner" },
    { q: "%" },
    { q: "/admin" },
    { q: [randomUUID()] },
    { state: "paid" },
    { state: ["confirmed", "all"] },
    { learnerId: randomUUID() },
    { role: "admin" },
    { next: "https://unrelated.test" },
    ...[0, 1001, 1.5, "", "01", "1e2", true, null, [1], ["1", "1"]].map(
      (page) => ({ page }),
    ),
    ...[0, 21, 1.5, "", true, null, [1]].map((pageSize) => ({ pageSize })),
  ])("refuses unsupported or ambiguous lookup fields: %j", (input) => {
    expect(staffBookingInput.safeParse(input).success).toBe(false);
  });
});
