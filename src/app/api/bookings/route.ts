import { getDomainAuthRuntime } from "@/lib/auth";
import { handleBookingRead } from "@/features/bookings/read-handler";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handleBookingRead(await getDomainAuthRuntime(), request);
}
