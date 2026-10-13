import { getAccountAuthRuntime } from "@/lib/auth";
import { privateJson } from "@/lib/auth-handler";
import { handleAccountSessions } from "@/features/account-sessions/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    return await handleAccountSessions(
      await getAccountAuthRuntime(),
      request,
      "revoke",
    );
  } catch {
    return privateJson(
      { message: "Account service is unavailable. Try again later." },
      503,
    );
  }
}
