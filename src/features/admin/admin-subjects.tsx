import {
  BookOpen,
  FlaskConical,
  Lightbulb,
  Plus,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { SubjectCategory } from "@/lib/db/schema/app";
import { groupSubjects } from "@/features/subjects/catalog";
import {
  AddSubjectForm,
  SubjectStateButton,
} from "@/features/subjects/subject-controls";
import { SubjectNameForm } from "@/features/subjects/subject-name-form";
import "./admin-subjects.css";

const categoryIcons: Record<SubjectCategory, LucideIcon> = {
  academic_core: BookOpen,
  test_prep: FlaskConical,
  academic_support: Lightbulb,
  specialized: Sparkles,
};

function monogram(name: string) {
  const trimmed = name.trim();
  if (/^[A-Z0-9]{2,4}$/.test(trimmed)) return trimmed;
  const letters = Array.from(trimmed.replace(/[^\p{L}\p{N}]/gu, ""));
  return (letters[0] ?? "").toLocaleUpperCase() + (letters[1] ?? "");
}

export type AdminSubject = {
  id: string;
  name: string;
  category: SubjectCategory;
  isActive: boolean;
  nameRevision: number;
};

/** Presentation only; the page loads subjects through its Admin guard. */
export function AdminSubjects({ subjects }: { subjects: AdminSubject[] }) {
  const active = subjects.filter((subject) => subject.isActive).length;
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">Operations</p>
          <h1>Subjects</h1>
          <p>
            Tutors choose from the active subjects. Deactivating a subject stops
            tutors from offering it and keeps existing records.
          </p>
        </div>
        <dl className="subject-tally">
          <div data-tone="active">
            <dt>Active</dt>
            <dd>{active}</dd>
          </div>
          <div>
            <dt>Inactive</dt>
            <dd>{subjects.length - active}</dd>
          </div>
        </dl>
      </header>
      {groupSubjects(subjects).map((group) => {
        const Icon = categoryIcons[group.category];
        const on = group.subjects.filter((subject) => subject.isActive).length;
        const off = group.subjects.length - on;
        return (
          <section
            key={group.category}
            className="subject-group"
            data-category={group.category}
            aria-labelledby={`subject-group-${group.category}`}
          >
            <div className="subject-group-heading">
              <span className="subject-group-icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <h2 id={`subject-group-${group.category}`}>{group.label}</h2>
              <p>
                {on} active
                {off > 0 && ` · ${off} inactive`}
              </p>
            </div>
            <ul className="subject-tiles">
              {group.subjects.map((subject) => (
                <li
                  key={subject.id}
                  className="subject-tile"
                  data-active={subject.isActive || undefined}
                >
                  <div className="subject-tile-top">
                    <span
                      className="subject-monogram"
                      aria-hidden="true"
                      data-monogram={monogram(subject.name)}
                    />
                    <div className="min-w-0">
                      <p className="subject-name">{subject.name}</p>
                      <p className="subject-status">
                        {subject.isActive ? "Active" : "Inactive"}
                      </p>
                    </div>
                  </div>
                  {subject.category === "specialized" && (
                    <SubjectNameForm subject={subject} />
                  )}
                  <SubjectStateButton subject={subject} tile />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <section aria-labelledby="add-subject-title" className="subject-add">
        <div className="subject-group-heading">
          <span className="subject-group-icon" aria-hidden="true">
            <Plus size={18} />
          </span>
          <h2 id="add-subject-title">Add a specialized subject</h2>
        </div>
        <AddSubjectForm />
      </section>
    </div>
  );
}
