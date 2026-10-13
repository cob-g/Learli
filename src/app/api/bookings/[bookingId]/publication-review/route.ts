import { getAuthRuntime } from "@/lib/auth";
import { handlePublication } from "@/features/review-publication/handler";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  return handlePublication(
    getAuthRuntime(),
    request,
    "author",
    (await params).bookingId,
  );
}
export const POST = GET;
