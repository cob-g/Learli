import { getAuthRuntime } from "@/lib/auth";
import { handleSupportRequest } from "@/features/support/handler";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handleSupportRequest(getAuthRuntime(), request, "reviewer");
}
