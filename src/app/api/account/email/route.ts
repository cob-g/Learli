import { getAuthRuntime } from "@/lib/auth";
import { handleAccountEmail } from "@/features/account-email/handler";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleAccountEmail(getAuthRuntime(), request);
}
