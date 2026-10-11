import { getAuthRuntime } from "@/lib/auth";
import { handleBookingRead } from "@/features/bookings/read-handler";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return handleBookingRead(getAuthRuntime(), request);
}
