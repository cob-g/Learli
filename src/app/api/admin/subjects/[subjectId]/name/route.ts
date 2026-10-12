import { getAuthRuntime } from "@/lib/auth";
import { privateJson } from "@/lib/auth-handler";
import { handleSubjectRenameRequest } from "@/features/subjects/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ subjectId: string }> },
) {
  try {
    return await handleSubjectRenameRequest(
      getAuthRuntime(),
      request,
      (await context.params).subjectId,
    );
  } catch {
    return privateJson(
      { message: "This service is unavailable. Try again later." },
      503,
    );
  }
}
