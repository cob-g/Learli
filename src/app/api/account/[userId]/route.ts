import { getAuthRuntime } from "@/lib/auth";
import { privateJson } from "@/lib/auth-handler";
import { handleAccountRequest } from "@/features/account/handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    return await handleAccountRequest(
      getAuthRuntime(),
      request,
      (await context.params).userId,
    );
  } catch {
    return privateJson(
      { message: "Account service is unavailable. Try again later." },
      503,
    );
  }
}
export const GET = handler;
export const PATCH = handler;
