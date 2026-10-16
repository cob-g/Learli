import { getDomainAuthRuntime } from "@/lib/auth";
import { handlePublication } from "@/features/review-publication/handler";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handlePublication(await getDomainAuthRuntime(), request, "moderator");
}
