import { bookingEvents } from "@/features/tutors/booking-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  return bookingEvents(request, "student");
}
