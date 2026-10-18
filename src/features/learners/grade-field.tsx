import type { ReactNode } from "react";

/** Optional school-year metadata, separate from the broad tutoring level. */
export function GradeField({
  grade,
  disabled,
  error,
}: {
  grade?: number | null;
  disabled?: boolean;
  error?: string;
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
        School year only. Select the education level separately.
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
