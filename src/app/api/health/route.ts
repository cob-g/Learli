export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Process liveness only. No claim of database or integration readiness. */
export function GET() {
  return Response.json(
    { status: "ok" },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
