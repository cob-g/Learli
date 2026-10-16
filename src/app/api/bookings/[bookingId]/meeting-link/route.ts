import { getDomainAuthRuntime } from "@/lib/auth";
import {
  handleMeetingEdit,
  handleMeetingRead,
} from "@/features/booking-meeting-links/handler";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ bookingId: string }> };
export async function GET(request: Request, context: Context) {
  return handleMeetingRead(
    await getDomainAuthRuntime(),
    request,
    (await context.params).bookingId,
  );
}
export async function PUT(request: Request, context: Context) {
  return handleMeetingEdit(
    await getDomainAuthRuntime(),
    request,
    (await context.params).bookingId,
  );
}
