import { getDomainAuthRuntime } from "@/lib/auth";
import { handleReview } from "@/features/private-reviews/handler";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  return handleReview(
    await getDomainAuthRuntime(),
    request,
    "author",
    bookingId,
  );
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  return handleReview(
    await getDomainAuthRuntime(),
    request,
    "author",
    bookingId,
  );
}
