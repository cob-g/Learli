import { getAuthRuntime } from "@/lib/auth";
import { privateJson } from "@/lib/auth-handler";
import { handleTutorProfileRequest } from "@/features/tutors/handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PUT(request: Request) {
  try {
    return await handleTutorProfileRequest(getAuthRuntime(), request);
  } catch {
    return privateJson(
      { message: "This service is unavailable. Try again later." },
      503,
    );
  }
}
