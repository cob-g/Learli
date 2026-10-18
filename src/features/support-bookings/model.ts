import type {
  BookingState,
  BookingEvent,
} from "@/features/bookings/lifecycle-model";
import type { LessonTimeValue } from "@/features/bookings/lesson-time";

export type SupportBookingContext =
  | {
      available: true;
      source?: "synthetic_readiness" | "local_operation";
      tutorName: string;
      subjectName: string;
      state: BookingState;
      time: LessonTimeValue;
      events: {
        event: BookingEvent;
        time: LessonTimeValue;
      }[];
    }
  | { available: false };
