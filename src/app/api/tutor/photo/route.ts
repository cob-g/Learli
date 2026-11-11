import { getDomainAuthRuntime } from "@/lib/auth";
import { privateJson } from "@/lib/auth-handler";
import { handleTutorPhotoRequest } from "@/features/tutor-photos/handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    return await handleTutorPhotoRequest(await getDomainAuthRuntime(), request);
  } catch {
    return privateJson(
      { message: "This service is unavailable. Try again later." },
      503,
    );
  }
}
export { handle as PUT, handle as DELETE };
