import { getDomainAuthRuntime } from "@/lib/auth";
import { privateJson } from "@/lib/auth-handler";
import { handleTutorProfileRequest } from "@/features/tutors/handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PUT(request: Request) {
  try {
    return await handleTutorProfileRequest(
      await getDomainAuthRuntime(),
      request,
    );
  } catch {
    return privateJson(
      { message: "This service is unavailable. Try again later." },
      503,
    );
  }
}
