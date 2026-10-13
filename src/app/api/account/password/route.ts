import { getAccountAuthRuntime } from "@/lib/auth";
import { handleAccountPassword } from "@/features/account-password/handler";
import { privateJson } from "@/lib/auth-handler";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    return await handleAccountPassword(await getAccountAuthRuntime(), request);
  } catch {
    return privateJson(
      { message: "Account service is unavailable. Try again later." },
      503,
    );
  }
}
