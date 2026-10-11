import { getAuthRuntime } from "@/lib/auth";
import { handleBookingRead } from "@/features/bookings/read-handler";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await context.params;
  return handleBookingRead(getAuthRuntime(), request, bookingId);
}
