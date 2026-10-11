import { getAuthRuntime } from "@/lib/auth";
import {
  handleMeetingEdit,
  handleMeetingRead,
} from "@/features/booking-meeting-links/handler";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ bookingId: string }> };
export async function GET(request: Request, context: Context) {
  return handleMeetingRead(
    getAuthRuntime(),
    request,
    (await context.params).bookingId,
  );
}
export async function PUT(request: Request, context: Context) {
  return handleMeetingEdit(
    getAuthRuntime(),
    request,
    (await context.params).bookingId,
  );
}
