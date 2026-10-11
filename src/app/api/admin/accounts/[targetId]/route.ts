import { getAuthRuntime } from "@/lib/auth";
import { handleAccountRestrictions } from "@/features/account-restrictions/handler";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ targetId: string }> };
export async function GET(request: Request, context: Context) {
  return handleAccountRestrictions(
    getAuthRuntime(),
    request,
    (await context.params).targetId,
  );
}
export async function PATCH(request: Request, context: Context) {
  return handleAccountRestrictions(
    getAuthRuntime(),
    request,
    (await context.params).targetId,
  );
}
