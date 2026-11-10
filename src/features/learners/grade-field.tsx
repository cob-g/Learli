import type { ReactNode } from "react";

/** Optional school-year metadata, separate from the broad tutoring level. */
export function GradeField({
  grade,
  disabled,
  error,
  levelEditable = true,
  college = false,
}: {
  grade?: number | null;
  disabled?: boolean;
  error?: string;
  levelEditable?: boolean;
  college?: boolean;
}) {
  const options: ReactNode[] = [
    <option key="none" value="">
      Not specified
    </option>,
    ...Array.from({ length: 12 }, (_, index) => (
      <option key={index + 1} value={index + 1}>
        Grade {index + 1}
      </option>
    )),
  ];
  return (
    <div className="space-y-2">
      <label className="block text-label" htmlFor="grade">
        Grade (optional)
      </label>
      <select
        className="field"
        id="grade"
        name="grade"
        defaultValue={grade ?? ""}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={`grade-help${error ? " grade-error" : ""}`}
      >
        {options}
      </select>
      <p id="grade-help" className="text-small text-muted-foreground">
        {college
          ? "College Support does not use a school grade. Select Not specified to clear a saved grade."
          : levelEditable
            ? "School year only. Choose the education level separately."
            : "School year only. The education level is fixed for this profile."}
      </p>
      {error && (
        <p id="grade-error" className="text-small text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function formGrade(value: FormDataEntryValue | null) {
  return typeof value === "string" && value !== "" ? Number(value) : null;
}
