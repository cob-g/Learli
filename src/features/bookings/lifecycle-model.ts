import type {
  WorkflowState,
  WorkflowEvent,
} from "@/features/booking-workflows/model";
import {
  workflowLabels,
  workflowEventLabels,
} from "@/features/booking-workflows/model";
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
export type BookingState = DemoBookingState | WorkflowState;
export type BookingEvent =
  "demo_reserved" | "demo_expired" | DemoLifecycleEvent | WorkflowEvent;
export const demoStateLabels: Record<BookingState, string> = {
  ...workflowLabels,
  demo_reserved: "Simulated reservation",
  demo_expired: "Simulation expired",
  demo_cancelled: "Simulation cancelled",
  demo_replaced: "Simulation replaced",
  demo_confirmed: "Fixture confirmation",
  demo_completed: "Fixture completion",
};
export function demoLiveState(state: BookingState) {
  return state === "demo_reserved" || state === "demo_confirmed";
}
export function effectiveDemoState(
  state: BookingState,
  expires: Date,
  now: Date,
): BookingState {
  if (state === "provisional") return expires <= now ? "expired" : state;
  return demoLiveState(state) && expires <= now ? "demo_expired" : state;
}
export type DemoLifecycleReceipt = {
  id: string;
  logicalBookingId: string;
  revision: number;
  eventId: string;
  state: BookingState;
};

export const bookingEventLabels: Record<BookingEvent, string> = {
  ...workflowEventLabels,
  demo_reserved: "Simulated reservation saved",
  demo_expired: "Simulation expiry saved",
  demo_cancelled: "Simulation cancelled",
  demo_rescheduled: "Simulation rescheduled",
  demo_confirmed: "Fixture confirmation",
  demo_completed: "Fixture completion",
};
