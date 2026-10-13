import type { Metadata } from "next";
import { Ban, CircleCheck } from "lucide-react";
import { loadPrivatePage } from "@/lib/permissions/workspace";
import { AdminShell } from "@/features/admin/admin-shell";
import { groupSubjects } from "@/features/subjects/catalog";
import { listSubjectsForAdmin } from "@/features/subjects/service";
import {
  AddSubjectForm,
  SubjectStateButton,
} from "@/features/subjects/subject-controls";
import { UnavailablePage } from "@/components/shared/unavailable-page";
import { SubjectNameForm } from "@/features/subjects/subject-name-form";
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
  return (
    <AdminShell current="subjects">
      <h1 className="text-page-title">Subjects</h1>
      <p className="mt-3 max-w-prose text-small text-muted-foreground">
        Tutors choose from the active subjects. Deactivating a subject stops
        tutors from offering it and keeps existing records.
      </p>
      {groupSubjects(subjects).map((group) => (
        <section key={group.category} className="mt-8 max-w-3xl">
          <h2 className="text-section-title">{group.label}</h2>
          <ul className="mt-4 border-t border-border">
            {group.subjects.map((subject) => {
              const Icon = subject.isActive ? CircleCheck : Ban;
              return (
                <li
                  key={subject.id}
                  className="flex flex-col items-start justify-between gap-4 border-b border-border py-6 sm:flex-row"
                >
                  <div className="w-full min-w-0 flex-1">
                    <p className="text-item-title wrap-anywhere text-primary">
                      {subject.name}
                    </p>
                    <p
                      className={
                        subject.isActive
                          ? "flex items-center gap-1 text-small text-success"
                          : "flex items-center gap-1 text-small text-muted-foreground"
                      }
                    >
                      <Icon size={16} aria-hidden="true" />
                      {subject.isActive ? "Active" : "Inactive"}
                    </p>
                    {subject.category === "specialized" && (
                      <SubjectNameForm subject={subject} />
                    )}
                  </div>
                  <SubjectStateButton subject={subject} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <section
        aria-labelledby="add-subject-title"
        className="mt-12 max-w-3xl border-t border-border pt-8"
      >
        <h2 id="add-subject-title" className="text-section-title">
          Add a specialized subject
        </h2>
        <div className="mt-4">
          <AddSubjectForm />
        </div>
      </section>
    </AdminShell>
  );
}
