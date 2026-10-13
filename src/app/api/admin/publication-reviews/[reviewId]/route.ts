import { getAuthRuntime } from "@/lib/auth";
import { handlePublication } from "@/features/review-publication/handler";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  return handlePublication(
    getAuthRuntime(),
    request,
    "moderator",
    (await params).reviewId,
  );
}
export const PATCH = GET;
