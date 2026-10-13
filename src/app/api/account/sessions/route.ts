import { getAccountAuthRuntime } from "@/lib/auth";
import { privateJson } from "@/lib/auth-handler";
import { handleAccountSessions } from "@/features/account-sessions/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return await handleAccountSessions(
      await getAccountAuthRuntime(),
      request,
      "list",
    );
  } catch {
    return privateJson(
      { message: "Account service is unavailable. Try again later." },
      503,
    );
  }
}
