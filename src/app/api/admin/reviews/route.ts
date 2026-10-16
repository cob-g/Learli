import { getDomainAuthRuntime } from "@/lib/auth";
import { handleReview } from "@/features/private-reviews/handler";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handleReview(await getDomainAuthRuntime(), request, "moderator");
}
