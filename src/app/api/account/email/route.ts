import { getAccountAuthRuntime } from "@/lib/auth";
import { handleAccountEmail } from "@/features/account-email/handler";
import { privateJson } from "@/lib/auth-handler";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    return await handleAccountEmail(await getAccountAuthRuntime(), request);
  } catch {
    return privateJson(
      { message: "Account service is unavailable. Try again later." },
      503,
    );
  }
}
