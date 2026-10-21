import { getDomainAuthRuntime } from "@/lib/auth";
import { handleParentChildRequest } from "@/features/parent-children/handler";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleParentChildRequest(await getDomainAuthRuntime(), request);
}
