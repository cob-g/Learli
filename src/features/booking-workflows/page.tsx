import { getLocalWorkflow } from "@/features/local-workflow/runtime";
import { requireIdentity } from "@/lib/permissions/access";
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
import { listTimeZoneOptions } from "@/lib/time/zones";
import { isValidTimeZone } from "@/lib/time/time-zone";
import { BookingChoiceForm } from "./choice-form";
import { bookingHistoryScope } from "./choice-options";
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
  const ordinaryParent =
    getLocalWorkflow(runtime) !== null &&
    (await requireIdentity(runtime, headers)).roles.includes("parent");
  const selectedLearner = options.learners.find(
    (learner) => learner.id === query.learnerId,
  );
  const scopeHint =
    query.scope === "guardian" || query.scope === "student"
      ? query.scope
      : undefined;
  const immediateConfirmation =
    !!selectedLearner &&
    options.immediateConfirmationLearnerIds.includes(selectedLearner.id);
  // Only the selected learner is private; retain the strict public selection contract.
  const publicQuery = Object.fromEntries(
    Object.entries(query).filter(
      ([key]) => key !== "learnerId" && key !== "scope",
    ),
  );
  const selected = parsePublicBookingSelection(publicQuery);
  const discovery = parsePublicBookingDiscovery(publicQuery);
  const queryZone =
    typeof query.displayTimezone === "string" &&
    isValidTimeZone(query.displayTimezone)
      ? query.displayTimezone
      : options.timezone;
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
  const historyScope = bookingHistoryScope(
    options.learners,
    typeof query.learnerId === "string" ? query.learnerId : undefined,
    scopeHint ?? (ordinaryParent ? "guardian" : "student"),
  );
  return (
    <div className="page-shell page-space">
      <h1 className="text-page-title">
        {immediateConfirmation
          ? "Book a session"
          : privateWorkflow
            ? "Request a booking"
            : "Synthetic booking request"}
      </h1>
      <p className="mt-4 max-w-prose text-body">
        {immediateConfirmation
          ? `Choose ${selectedLearner?.management === "self" ? "an eligible tutor" : "your child, an eligible tutor"} and an available time. A valid no-money booking is confirmed when you save it.`
          : privateWorkflow
            ? "Choose an authorized learner, tutor and available time. Your request remains provisional until an assigned reviewer confirms it."
            : "Fictional readiness only. Choose an admitted learner and screened tutor; an assigned synthetic prerequisite review is required for confirmation. Real booking policies remain unavailable."}
      </p>
      {!options.learners.length ? (
        <AdmissionDetour
          choice={selected}
          discovery={discovery}
          privateWorkflow={privateWorkflow}
          ordinaryParent={ordinaryParent}
        />
      ) : (
        <BookingChoiceForm
          learners={options.learners}
          tutors={options.tutors}
          zones={listTimeZoneOptions(new Date(), [options.timezone, queryZone])}
          initial={{
            learnerId:
              typeof query.learnerId === "string" ? query.learnerId : "",
            subjectSlug:
              typeof query.subjectSlug === "string" ? query.subjectSlug : "",
            tutorSlug:
              typeof query.tutorSlug === "string" ? query.tutorSlug : "",
            displayTimezone: queryZone,
          }}
          requestedTime={selected ?? undefined}
          scopeHint={scopeHint}
          privateWorkflow={privateWorkflow}
        />
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
            immediateConfirmation={immediateConfirmation}
            source={
              c.booking.authority === "disabled" ? undefined : c.booking.source
            }
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
      <a
        className="mt-8 inline-flex min-h-11 items-center"
        href={`/bookings?scope=${historyScope}`}
      >
        Your booking history
      </a>
    </div>
  );
}
