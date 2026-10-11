import { getAuthRuntime } from "@/lib/auth";
import { handleDemoBookingCreate } from "@/features/bookings/handler";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return handleDemoBookingCreate(getAuthRuntime(), request);
}
