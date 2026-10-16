import { AdmissionDetour } from "@/features/learner-admission/detour";
import {
  parsePublicBookingSelection,
  parsePublicBookingDiscovery,
} from "@/features/bookings/selection";
import type { AuthRuntime } from "@/lib/auth-factory";
import { bookingWorkflowContext } from "./composition";
import { loadWorkflowOptions, readWorkflowCandidates } from "./service";
import { WorkflowRequestForm } from "./forms";
import { workflowChoice } from "./input";
import { AccessError } from "@/lib/permissions/access";
export async function WorkflowBookingPage({
  runtime,
  headers,
  query,
  privateWorkflow = false,
}: {
  runtime: AuthRuntime;
  headers: Headers;
  query: Record<string, string | string[] | undefined>;
  privateWorkflow?: boolean;
}) {
  const c = bookingWorkflowContext(runtime),
    options = await loadWorkflowOptions(c, headers);
  // Only the selected learner is private; retain the strict public selection contract.
  const publicQuery = Object.fromEntries(
    Object.entries(query).filter(([key]) => key !== "learnerId"),
  );
  const selected = parsePublicBookingSelection(publicQuery);
  const discovery = parsePublicBookingDiscovery(publicQuery);
  const values = workflowChoice.safeParse({
    learnerId: query.learnerId,
    tutorSlug: query.tutorSlug,
    subjectSlug: query.subjectSlug,
    displayTimezone: query.displayTimezone ?? options.timezone,
  });
  let times: Awaited<ReturnType<typeof readWorkflowCandidates>> = [],
    message = "";
  if (values.success) {
    try {
      times = await readWorkflowCandidates(c, headers, values.data);
    } catch (e) {
      if (e instanceof AccessError && e.status === 404)
        message =
          "These booking choices are unavailable on this account. Choose your own learner and current tutor.";
      else
        message =
          "Open times could not be loaded. Try again or contact support.";
    }
  }
  const fields = [
    {
      name: "learnerId",
      label: "Learner",
      values: options.learners.map((l) => ({
        value: l.id,
        label: l.displayName,
      })),
    },
    {
      name: "tutorSlug",
      label: "Tutor",
      values: options.tutors.map((t) => ({
        value: t.slug,
        label: t.displayName,
      })),
    },
    {
      name: "subjectSlug",
      label: "Subject",
      values: [
        ...new Map(
          options.tutors.flatMap((t) =>
            t.offerings.map(
              (s) =>
                [
                  s.subjectSlug,
                  { value: s.subjectSlug, label: s.subjectName },
                ] as const,
            ),
          ),
        ).values(),
      ],
    },
  ];
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">
        {privateWorkflow ? "Request a booking" : "Synthetic booking request"}
      </h1>
      <p className="mt-4 max-w-prose text-body">
        {privateWorkflow
          ? "Choose an authorized learner, tutor and available time. Your request remains provisional until an assigned reviewer confirms it."
          : "Fictional readiness only. Choose an admitted learner and screened tutor; an assigned synthetic prerequisite review is required for confirmation. Real booking policies remain unavailable."}
      </p>
      {!options.learners.length ? (
        <AdmissionDetour
          choice={selected}
          discovery={discovery}
          privateWorkflow={privateWorkflow}
        />
      ) : (
        <form
          method="get"
          action={privateWorkflow ? "/bookings/new" : undefined}
          className="mt-6 max-w-xl space-y-4"
        >
          {selected && (
            <>
              <input type="hidden" name="level" value={selected.level} />
              <input
                type="hidden"
                name="startAtUtc"
                value={selected.startAtUtc}
              />
              <input type="hidden" name="endAtUtc" value={selected.endAtUtc} />
            </>
          )}
          {fields.map((f) => (
            <div key={f.name}>
              <label htmlFor={f.name} className="text-label">
                {f.label}
              </label>
              <select
                required
                id={f.name}
                name={f.name}
                className="field mt-2"
                defaultValue={
                  typeof query[f.name] === "string" ? query[f.name] : ""
                }
              >
                <option value="">Choose {f.label.toLowerCase()}</option>
                {f.values.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <label htmlFor="displayTimezone" className="text-label">
            Time zone
          </label>
          <input
            id="displayTimezone"
            name="displayTimezone"
            className="field"
            defaultValue={
              typeof query.displayTimezone === "string"
                ? query.displayTimezone
                : options.timezone
            }
          />
          <button className="action action-outline" type="submit">
            {privateWorkflow ? "Show available times" : "Load synthetic times"}
          </button>
        </form>
      )}
      {values.success &&
        selected &&
        !times.some(
          (t) =>
            t.startAtUtc === selected.startAtUtc &&
            t.endAtUtc === selected.endAtUtc,
        ) && (
          <p className="mt-4 text-body">
            The selected time is no longer available for these choices. Choose a
            current time; nothing has been reserved.
          </p>
        )}
      {message && (
        <p role="alert" className="mt-4 text-body">
          {message}
        </p>
      )}
      {values.success &&
        (times.length ? (
          <WorkflowRequestForm
            choice={values.data}
            times={times}
            requestedTime={selected ?? undefined}
            privateWorkflow={privateWorkflow}
            scope={
              options.learners.find((l) => l.id === values.data.learnerId)
                ?.management === "guardian"
                ? "guardian"
                : "student"
            }
          />
        ) : (
          <p className="mt-4 text-body">
            {privateWorkflow
              ? "No available times match these choices."
              : "No current synthetic times match these choices."}
          </p>
        ))}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Native navigation replaces the prior private document. */}
      <a className="mt-8 inline-flex min-h-11 items-center" href="/bookings">
        Your booking history
      </a>
    </div>
  );
}
