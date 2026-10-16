import { getDomainAuthRuntime } from "@/lib/auth";
import { privateJson } from "@/lib/auth-handler";
import { handleStaffBookingList } from "@/features/booking-workflows/staff-handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return await handleStaffBookingList(await getDomainAuthRuntime(), request);
  } catch {
    return privateJson(
      { message: "Assigned bookings are unavailable. Try again later." },
      503,
    );
  }
}
