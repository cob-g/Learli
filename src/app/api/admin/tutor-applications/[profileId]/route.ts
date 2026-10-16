import { getDomainAuthRuntime } from "@/lib/auth";
import { privateJson } from "@/lib/auth-handler";
import { handleTutorReviewRequest } from "@/features/tutors/handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  try {
    return await handleTutorReviewRequest(
      await getDomainAuthRuntime(),
      request,
      (await context.params).profileId,
    );
  } catch {
    return privateJson(
      { message: "This service is unavailable. Try again later." },
      503,
    );
  }
}
