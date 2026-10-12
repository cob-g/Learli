/** Client-safe local semantics. Never a real lesson/payment/attendance status. */
export type DemoBookingState =
  | "demo_reserved"
  | "demo_expired"
  | "demo_cancelled"
  | "demo_replaced"
  | "demo_confirmed"
  | "demo_completed";
export type DemoLifecycleEvent =
  "demo_cancelled" | "demo_rescheduled" | "demo_confirmed" | "demo_completed";
export const demoStateLabels: Record<DemoBookingState, string> = {
  demo_reserved: "Simulated reservation",
  demo_expired: "Simulation expired",
  demo_cancelled: "Simulation cancelled",
  demo_replaced: "Simulation replaced",
  demo_confirmed: "Fixture confirmation",
  demo_completed: "Fixture completion",
};
export function demoLiveState(state: DemoBookingState) {
  return state === "demo_reserved" || state === "demo_confirmed";
}
export function effectiveDemoState(
  state: DemoBookingState,
  expires: Date,
  now: Date,
): DemoBookingState {
  return demoLiveState(state) && expires <= now ? "demo_expired" : state;
}
export type DemoLifecycleReceipt = {
  id: string;
  logicalBookingId: string;
  revision: number;
  eventId: string;
  state: DemoBookingState;
};
