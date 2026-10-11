import { getAuthRuntime } from "@/lib/auth";
import { handleAccountRestrictions } from "@/features/account-restrictions/handler";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handleAccountRestrictions(getAuthRuntime(), request);
}
