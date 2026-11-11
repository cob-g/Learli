// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TutorProfileForm,
  type TutorProfileFormValues,
} from "@/features/tutors/tutor-profile-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));

const initial: TutorProfileFormValues = {
  headline: "Patient maths tutor",
  bio: "Fictional bio",
  teachingBackground: "Fictional background",
  teachingLanguages: ["en"],
  timezone: "Asia/Manila",
  offerings: [
    { subjectId: "subject-1", levels: ["high_school"], specialty: null },
  ],
};
const subjects = [
  {
    id: "subject-1",
    name: "Algebra",
    category: "academic_core" as const,
    isActive: true,
  },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderForm() {
  render(
    <TutorProfileForm
      initial={initial}
      subjects={subjects}
      timeZones={[{ value: "Asia/Manila", label: "Asia/Manila" }]}
      defaultTimeZone="Asia/Manila"
    />,
  );
}

describe("tutor profile unsaved-changes indicator", () => {
  it("keeps showing unsaved changes when the tutor edits during an in-flight save", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    renderForm();
    const headline = screen.getByLabelText(/headline/i);
    fireEvent.input(headline, { target: { value: "Edited before save" } });
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /save profile/i }),
    );
    fireEvent.input(headline, { target: { value: "Edited during save" } });
    finish(Response.json({}, { status: 200 }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /save profile/i }),
      ).toBeEnabled(),
    );
    expect(screen.queryByText("Profile saved.")).not.toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("still reports a clean save when nothing changed while saving", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({}, { status: 200 })),
    );
    renderForm();
    fireEvent.input(screen.getByLabelText(/headline/i), {
      target: { value: "Edited before save" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: /save profile/i }),
    );
    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });
});
