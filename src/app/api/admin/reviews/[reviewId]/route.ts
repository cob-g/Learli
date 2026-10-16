import { getDomainAuthRuntime } from "@/lib/auth";
import { handleReview } from "@/features/private-reviews/handler";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const { reviewId } = await params;
  return handleReview(
    await getDomainAuthRuntime(),
    request,
    "moderator",
    reviewId,
  );
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const { reviewId } = await params;
  return handleReview(
    await getDomainAuthRuntime(),
    request,
    "moderator",
    reviewId,
  );
}
