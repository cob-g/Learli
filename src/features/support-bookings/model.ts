import type { DemoBookingState } from "@/features/bookings/lifecycle-model";
import type { LessonTimeValue } from "@/features/bookings/lesson-time";

export type SupportBookingContext =
  | {
      available: true;
      tutorName: string;
      subjectName: string;
      state: DemoBookingState;
      time: LessonTimeValue;
      events: {
        event: "demo_reserved" | "demo_expired";
        time: LessonTimeValue;
      }[];
    }
  | { available: false };
