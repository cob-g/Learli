import { getAuthRuntime } from "@/lib/auth";
import { handleAccountPassword } from "@/features/account-password/handler";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleAccountPassword(getAuthRuntime(), request);
}
