import "@/features/tutors/tutor-bookings.css";
import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { requireRole } from "@/lib/permissions/access";
import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { googleMeetConfig } from "@/features/google-meet/config";
import { readGoogleConnection } from "@/features/google-meet/service";
import { GoogleMeetConnectionPanel } from "@/features/google-meet/connection-panel";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Meeting setup",
  robots: { index: false, follow: false },
};
export default async function TutorMeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const data = await loadPrivatePage(
    "/tutor/meetings",
    async (runtime, headers) => {
      await requireRole(runtime, headers, "tutor");
      if (!getLocalWorkflow(runtime))
        return { enabled: false, connection: null };
      const config = googleMeetConfig();
      return {
        enabled: !!config,
        connection: await readGoogleConnection(
          runtime,
          headers,
          config?.fingerprint,
        ),
      };
    },
  );
  if (!data)
    return (
      <UnavailablePage
        title="Meeting setup unavailable"
        message="Return to your account to check your access, or try again."
      />
    );
  const result = (await searchParams).result;
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div>
          <p className="workspace-eyebrow">Tutor workspace</p>
          <h1>Meeting setup</h1>
          <p>
            Connect your Google account or keep arranging meetings with manual
            links.
          </p>
        </div>
      </header>
      <GoogleMeetConnectionPanel
        {...data}
        result={typeof result === "string" ? result : undefined}
      />
    </div>
  );
}
