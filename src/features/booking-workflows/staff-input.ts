import { z } from "zod";

export const staffBookingStates = [
  "all",
  "provisional",
  "confirmed",
  "completed",
  "no_show",
  "expired",
  "cancelled",
  "replaced",
] as const;
const pageNumber = (maximum: number, fallback: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && /^[1-9][0-9]*$/.test(value)
        ? Number(value)
        : value,
    z.number().int().min(1).max(maximum).default(fallback),
  );
export const staffBookingInput = z.strictObject({
  q: z
    .union([z.literal(""), z.uuid()])
    .optional()
    .transform((value) => value || undefined),
  state: z.enum(staffBookingStates).default("all"),
  page: pageNumber(1000, 1),
  pageSize: pageNumber(20, 20),
});
export type StaffBookingFilters = z.infer<typeof staffBookingInput>;

export function staffBookingsHref(
  filters: StaffBookingFilters,
  page = filters.page,
) {
  const query = new URLSearchParams({
    state: filters.state,
    page: String(page),
    pageSize: String(filters.pageSize),
  });
  if (filters.q) query.set("q", filters.q);
  return `/admin/bookings?${query}`;
}
export function staffBookingHref(id: string, filters: StaffBookingFilters) {
  return `/admin/bookings/${encodeURIComponent(id)}${staffBookingsHref(filters).slice("/admin/bookings".length)}`;
}
