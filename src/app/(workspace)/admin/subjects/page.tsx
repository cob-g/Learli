import type { Metadata } from "next";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { AdminSubjects } from "@/features/admin/admin-subjects";
import { listSubjectsForAdmin } from "@/features/subjects/service";
import { UnavailablePage } from "@/components/shared/unavailable-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Manage subjects",
  robots: { index: false, follow: false },
};
export default async function AdminSubjectsPage() {
  const subjects = await loadPrivatePage(
    "/admin/subjects",
    listSubjectsForAdmin,
  );
  if (!subjects)
    return (
      <UnavailablePage
        title="Workspace access unavailable"
        message="This workspace is not available to your current account. Return to your account to see your assigned access."
      />
    );
  return <AdminSubjects subjects={subjects} />;
}
