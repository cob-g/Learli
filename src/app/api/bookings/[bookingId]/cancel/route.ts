import { getAuthRuntime } from "@/lib/auth";
import { handleDemoLifecycleChange } from "@/features/bookings/lifecycle-handler";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  return handleDemoLifecycleChange(
    getAuthRuntime(),
    request,
    bookingId,
    "cancel",
  );
}
