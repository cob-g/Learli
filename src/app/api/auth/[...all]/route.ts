import { getAuthRuntime } from "@/lib/auth";
import { handleAuthRequest, privateJson } from "@/lib/auth-handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(request: Request) {
  try {
    return await handleAuthRequest(getAuthRuntime(), request);
  } catch {
    return privateJson(
      { message: "Account service is unavailable. Try again later." },
      503,
    );
  }
}
export const GET = handler;
export const POST = handler;
