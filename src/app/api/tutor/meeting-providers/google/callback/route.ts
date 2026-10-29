import { getDomainAuthRuntime } from "@/lib/auth";
import { handleGoogleMeet } from "@/features/google-meet/handler";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handleGoogleMeet(await getDomainAuthRuntime(), request, "callback");
}
