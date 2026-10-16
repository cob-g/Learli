import { getDomainAuthRuntime } from "@/lib/auth";
import { handleSupportRequest } from "@/features/support/handler";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handleSupportRequest(
    await getDomainAuthRuntime(),
    request,
    "requester",
  );
}
export async function POST(request: Request) {
  return handleSupportRequest(
    await getDomainAuthRuntime(),
    request,
    "requester",
  );
}
