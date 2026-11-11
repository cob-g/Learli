import { describe, expect, it } from "vitest";
import {
  bookingPhase,
  demoLiveState,
  demoStateLabels,
  type BookingState,
} from "@/features/bookings/lifecycle-model";

// Every saved state, read from the exhaustive label map.
const states = Object.keys(demoStateLabels) as BookingState[];

describe("booking phase", () => {
  it("places every state", () => {
    expect(states).toHaveLength(13);
    for (const state of states)
      expect(["held", "confirmed", "ended"]).toContain(bookingPhase(state));
  });

  it("matches the hand-written checks it replaced, state by state", () => {
    for (const state of states) {
      // read-status: a deadline timer runs for a live demo or provisional hold.
      expect(bookingPhase(state) === "held").toBe(
        demoLiveState(state) || state === "provisional",
      );
      // dashboard, agenda and read-status: anything else that is not a
      // confirmed lesson has ended.
      expect(bookingPhase(state) === "ended").toBe(
        !demoLiveState(state) &&
          state !== "provisional" &&
          state !== "confirmed",
      );
    }
  });

  it("only a confirmed lesson is confirmed", () => {
    expect(
      states.filter((state) => bookingPhase(state) === "confirmed"),
    ).toEqual(["confirmed"]);
  });
});
