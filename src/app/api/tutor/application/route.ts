import { getAuthRuntime } from "@/lib/auth";
import { privateJson } from "@/lib/auth-handler";
import { handleTutorApplicationStart } from "@/features/tutors/handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    return await handleTutorApplicationStart(getAuthRuntime(), request);
  } catch {
    return privateJson(
      { message: "This service is unavailable. Try again later." },
      503,
    );
  }
}
