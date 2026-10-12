export const noticeKinds = [
  "simulated_reservation_created",
  "simulated_reservation_cancelled",
  "simulated_reservation_rescheduled",
  "simulated_fixture_confirmed",
  "simulated_fixture_completed",
] as const;
export type BookingNoticeKind = (typeof noticeKinds)[number];
export type LifecycleNoticeKind = Exclude<
  BookingNoticeKind,
  "simulated_reservation_created"
>;
