import { getDomainAuthRuntime } from "@/lib/auth";
import { serveTutorPhoto } from "@/features/tutor-photos/handler";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ photoId: string }> },
) {
  try {
    return await serveTutorPhoto(
      await getDomainAuthRuntime(),
      request,
      (await context.params).photoId,
    );
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
