import {
  bookingPhase,
  demoLiveState,
} from "@/features/bookings/lifecycle-model";
import Link from "next/link";
import "./family-dashboard.css";
import {
  ArrowRight,
  CalendarDays,
  Check,
  History,
  TimerOff,
  TriangleAlert,
} from "lucide-react";
import {
  LessonTime,
  type LessonTimeValue,
} from "@/features/bookings/lesson-time";
import { levelNames } from "@/features/subjects/catalog";
import {
  bookingDetailPath,
  historicalBookingDetailPath,
} from "@/features/bookings/read-model";
import { bookingStatusLabel } from "@/features/private-workflow/notice";
import type { LearnerLevel } from "@/lib/db/schema/app";
import { ExpiryRefresh } from "./expiry-refresh";
import { DashboardFilterForm, DashboardLink } from "./pending";
import { StudentBookingLive } from "@/features/tutors/booking-refresh";
import {
  dashboardHref,
  groupByDate,
  type DashboardLearner,
  type DashboardQuery,
  type FamilyWorkspace,
  type ReservationView,
} from "./model";

export type DashboardData = {
  workspace: FamilyWorkspace;
  learners: DashboardLearner[];
  selectedLearner?: DashboardLearner;
  query: DashboardQuery;
  active: ReservationView[];
  history: ReservationView[];
  activeHasNext: boolean;
  historyHasNext: boolean;
  checkedAt: LessonTimeValue;
  /** Server aggregate over every active timed reservation; absent = page rows only. */
  earliestExpiry?: string | null;
};

export function StatusBadge({
  state,
  privateWorkflow = false,
}: {
  state: ReservationView["state"];
  privateWorkflow?: boolean;
}) {
  const expired = bookingPhase(state) === "ended";
  const success =
    privateWorkflow && (state === "confirmed" || state === "completed");
  const Icon = success ? Check : expired ? TimerOff : TriangleAlert;
  return (
    <span
      className="workspace-pill family-status"
      data-tone={success ? "success" : expired ? undefined : "waiting"}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 wrap-anywhere">
        {bookingStatusLabel(state, privateWorkflow)}
      </span>
    </span>
  );
}

function LearnerSelector({
  learners,
  selected,
}: {
  learners: DashboardLearner[];
  selected?: string;
}) {
  const options = [
    { id: "", displayName: "All learners", level: "" },
    ...learners,
  ];
  return (
    <DashboardFilterForm key={selected ?? "all"}>
      <fieldset className="family-filter">
        <legend className="family-filter-legend">Show bookings for</legend>
        <div className="family-chips">
          {options.map((learner) => (
            <label key={learner.id} className="family-chip">
              <input
                type="radio"
                className="shrink-0"
                name="learner"
                value={learner.id}
                defaultChecked={(selected ?? "") === learner.id}
              />
              <span className="min-w-0 wrap-anywhere">
                {learner.displayName}
                {learner.level
                  ? ` · ${levelNames([learner.level as LearnerLevel]).join()}`
                  : ""}
              </span>
              <Check
                className="family-chip-check size-4 shrink-0"
                aria-hidden="true"
              />
            </label>
          ))}
        </div>
      </fieldset>
      <button
        className="action action-outline family-filter-submit"
        type="submit"
      >
        Show bookings
      </button>
    </DashboardFilterForm>
  );
}

function ViewBooking({
  row,
  workspace,
}: {
  row: ReservationView;
  workspace: FamilyWorkspace;
}) {
  return (
    <Link
      className="family-view-booking"
      href={
        row.currentHeadId && row.currentHeadId !== row.id
          ? historicalBookingDetailPath(
              row.id,
              workspace === "parent" ? "guardian" : "student",
            )
          : bookingDetailPath(
              row.id,
              workspace === "parent" ? "guardian" : "student",
            )
      }
      aria-label={`View booking for ${row.learner.displayName} with ${row.tutorName}`}
    >
      View booking
    </Link>
  );
}

function expiryLabel(row: ReservationView, privateWorkflow = false) {
  if (privateWorkflow && row.state === "expired")
    return "Provisional hold expired at";
  return row.state === "confirmed"
    ? "Original provisional deadline (confirmation does not expire)"
    : row.state === "provisional"
      ? "Provisional hold expires at"
      : row.state === "demo_expired"
        ? "Simulation expired at"
        : demoLiveState(row.state)
          ? "Simulation expires at"
          : "Original simulation deadline";
}

function Expiry({
  row,
  privateWorkflow = false,
}: {
  row: ReservationView;
  privateWorkflow?: boolean;
}) {
  if (
    privateWorkflow &&
    row.state !== "provisional" &&
    row.state !== "expired" &&
    !row.state.startsWith("demo_")
  )
    return null;
  return (
    <details className="mt-2">
      <summary className="min-h-11 cursor-pointer py-2 text-small text-primary underline">
        {expiryLabel(row, privateWorkflow)}
      </summary>
      <LessonTime value={row.expiry} />
    </details>
  );
}

function Agenda({
  rows,
  workspace,
  privateWorkflow = false,
}: {
  rows: ReservationView[];
  workspace: FamilyWorkspace;
  privateWorkflow?: boolean;
}) {
  return (
    <div className="family-days">
      {groupByDate(rows).map((group) => (
        <section key={group.key}>
          <h3 className="family-day">{group.date}</h3>
          <p className="family-day-zone">Times shown in {group.zone}.</p>
          <ul className="family-rows">
            {group.reservations.map((row) => (
              <li key={row.id}>
                <div className="family-row-time min-w-0">
                  <LessonTime value={row.when} variant="time-only" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-item-title wrap-anywhere">
                    {row.subjectName} with {row.tutorName}
                  </h4>
                  {workspace === "parent" && (
                    <p className="mt-2 text-body wrap-anywhere">
                      For {row.learner.displayName}
                    </p>
                  )}
                  <div className="mt-2">
                    <StatusBadge
                      state={row.state}
                      privateWorkflow={privateWorkflow}
                    />
                  </div>
                  <Expiry row={row} privateWorkflow={privateWorkflow} />
                </div>
                <div className="family-row-action">
                  <ViewBooking row={row} workspace={workspace} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Pagination({
  data,
  kind,
}: {
  data: DashboardData;
  kind: "active" | "history";
}) {
  const key = "historyPage";
  const page = data.query[key] ?? 1;
  const more = kind === "active" ? data.activeHasNext : data.historyHasNext;
  if (page === 1 && !more) return null;
  return (
    <nav
      className="family-pagination"
      aria-label={
        kind === "active"
          ? "Active reservations pages"
          : "Reservation history pages"
      }
    >
      {page > 1 && (
        <Link
          className="action action-outline"
          href={dashboardHref(
            data.workspace,
            { ...data.query, [key]: page - 1 },
            `#${kind}`,
          )}
        >
          Previous page
        </Link>
      )}
      <p className="text-small">Page {page}</p>
      {more && (
        <Link
          className="action action-outline"
          href={dashboardHref(
            data.workspace,
            { ...data.query, [key]: page + 1 },
            `#${kind}`,
          )}
        >
          Next page
        </Link>
      )}
    </nav>
  );
}

function NextReservation({
  next,
  workspace,
  privateWorkflow,
}: {
  next: ReservationView;
  workspace: FamilyWorkspace;
  privateWorkflow: boolean;
}) {
  const Heading = workspace === "parent" ? "h3" : "h2";
  return (
    <section className="family-next" aria-labelledby="next-reservation">
      <span className="family-next-tile" aria-hidden="true">
        <CalendarDays size={34} />
      </span>
      <div className="min-w-0">
        <Heading id="next-reservation" className="family-next-label">
          {privateWorkflow ? "Next session" : "Next simulated reservation"}
        </Heading>
        <div className="mt-4 grid min-w-0 gap-6 md:grid-cols-2">
          <div className="min-w-0">
            <LessonTime value={next.when} variant="prominent" />
          </div>
          <div className="min-w-0">
            <p className="text-item-title wrap-anywhere text-primary">
              {next.subjectName} with {next.tutorName}
            </p>
            {workspace === "parent" && (
              <p className="mt-2 text-body wrap-anywhere">
                For {next.learner.displayName}
              </p>
            )}
            <p className="mt-2 text-small">{next.durationMinutes} minutes</p>
            <div className="mt-4">
              <StatusBadge
                state={next.state}
                privateWorkflow={privateWorkflow}
              />
            </div>
          </div>
        </div>
        <p className="mt-6 max-w-prose border-t border-border pt-6 text-small text-muted-foreground">
          {next.state === "confirmed"
            ? "This booking is confirmed and does not expire. Refresh bookings to check its current status."
            : privateWorkflow && next.state === "provisional"
              ? "This provisional hold awaits an assigned review. It expires if it is not confirmed before the deadline."
              : "This is a temporary local reservation. Refresh bookings to check its current status."}
        </p>
        {(!privateWorkflow ||
          next.state === "provisional" ||
          next.state.startsWith("demo_")) && (
          <>
            <p className="mt-4 text-label">
              {expiryLabel(next, privateWorkflow)}
            </p>
            <LessonTime value={next.expiry} />
          </>
        )}
        <div className="mt-4">
          <ViewBooking row={next} workspace={workspace} />
        </div>
      </div>
    </section>
  );
}

export function FamilyDashboard({
  data,
  privateWorkflow = false,
  ordinaryParent = false,
  ordinaryStudent = false,
}: {
  data: DashboardData;
  privateWorkflow?: boolean;
  ordinaryParent?: boolean;
  ordinaryStudent?: boolean;
}) {
  const { workspace, learners, selectedLearner, active, history } = data;
  const next = active.find((row) => row.startAtUtc > data.checkedAt.startAtUtc);
  const agenda = active.filter((row) => row.id !== next?.id);
  const title = workspace === "student" ? "Your bookings" : "Parent Dashboard";
  const learnerContext =
    selectedLearner ?? (learners.length === 1 ? learners[0] : undefined);
  const timedActive = active.filter((row) => row.state !== "confirmed");
  const earliestExpiry =
    data.earliestExpiry !== undefined
      ? data.earliestExpiry
      : timedActive.length
        ? timedActive.reduce(
            (earliest, row) =>
              row.expiresAt < earliest ? row.expiresAt : earliest,
            timedActive[0].expiresAt,
          )
        : null;
  return (
    <div className="workspace-page family-page">
      <header className="workspace-page-header">
        <div className="min-w-0">
          <p className="workspace-eyebrow">
            {workspace === "parent" ? "Parent workspace" : "Student workspace"}
          </p>
          <h1 className="wrap-anywhere">{title}</h1>
          {workspace === "parent" && !!learners.length && (
            <p className="family-context wrap-anywhere">
              {learnerContext
                ? `Bookings for ${learnerContext.displayName}`
                : "Bookings for all authorized learners"}
            </p>
          )}
          <p className="family-lede">
            {ordinaryParent
              ? "Manage upcoming sessions and booking history for your children."
              : ordinaryStudent
                ? "Manage upcoming sessions and booking history."
                : privateWorkflow
                  ? "Manage upcoming sessions and booking history. Provisional requests await an assigned review before confirmation."
                  : "Local simulation only. Reservations expire after ten minutes and do not confirm a lesson."}
          </p>
        </div>
        {privateWorkflow && (
          <nav
            aria-label="Booking and learner actions"
            className="family-actions"
          >
            <Link className="action workspace-action" href="/tutors">
              Find a tutor
              <span className="workspace-action-icon" aria-hidden="true">
                <ArrowRight size={15} />
              </span>
            </Link>
            {!!learners.length && (
              <DashboardLink href="/bookings/new">New booking</DashboardLink>
            )}
            {!ordinaryStudent && (
              <DashboardLink
                href={
                  workspace === "parent"
                    ? "/parent/children/new"
                    : "/learner-admission/new"
                }
              >
                {workspace === "parent"
                  ? "Add Child"
                  : "Request learner review"}
              </DashboardLink>
            )}
            {!ordinaryParent && !ordinaryStudent && (
              <DashboardLink href="/learner-admission">
                Admission requests
              </DashboardLink>
            )}
          </nav>
        )}
      </header>
      {workspace === "parent" && learners.length > 1 && (
        <LearnerSelector learners={learners} selected={selectedLearner?.id} />
      )}
      {workspace === "parent" && !!learners.length && (
        <nav aria-label="Parent Dashboard sections" className="family-subnav">
          <a
            href={dashboardHref(workspace, data.query, "#active")}
            className="family-link"
          >
            Upcoming Sessions
          </a>
          <a
            href={dashboardHref(workspace, data.query, "#history")}
            className="family-link"
          >
            Booking History
          </a>
        </nav>
      )}
      <div className="family-meta">
        <p className="family-meta-text">
          Times shown in {data.checkedAt.zone}.
        </p>
        <Link
          href={workspace === "parent" ? "/parent/profile" : "/account"}
          className="family-link family-link-small"
        >
          {workspace === "parent"
            ? "Change time zone in Parent Profile"
            : "Change time zone in account settings"}
        </Link>
        <div className="family-meta-text family-meta-tools">
          <details>
            <summary className="min-h-11 cursor-pointer py-2">
              Status checked at
            </summary>
            <LessonTime value={data.checkedAt} />
          </details>
          <DashboardLink href={dashboardHref(workspace, data.query)}>
            Refresh bookings
          </DashboardLink>
          {learners.length > 0 && (
            <StudentBookingLive
              showStatus
              audience={workspace === "parent" ? "parent" : "student"}
            />
          )}
        </div>
      </div>
      {!learners.length ? (
        <section className="workspace-blank">
          <h2>
            {ordinaryParent
              ? "Add your first child"
              : "No authorized learner available"}
          </h2>
          <p>
            {ordinaryParent
              ? "Add your child and confirm your guardian authority and consent. The saved profile will be ready for booking."
              : ordinaryStudent
                ? "Set up your Student profile and confirm your independent eligibility to start arranging tutoring."
                : privateWorkflow
                  ? "Request a learner review to continue. Pending requests grant no learner or booking access; an assigned reviewer must authorize the request first."
                  : "This account has no eligible local learner profile. Create a fictional profile to try the local booking flow."}
          </p>
          <div className="mt-2">
            <DashboardLink
              href={
                workspace === "parent"
                  ? "/parent/children/new"
                  : ordinaryStudent
                    ? "/student/onboarding"
                    : privateWorkflow
                      ? "/learner-admission"
                      : "/learners/new"
              }
            >
              {workspace === "parent"
                ? "Add Child"
                : ordinaryStudent
                  ? "Set up your Student profile"
                  : privateWorkflow
                    ? "View admission requests"
                    : "Create a local learner"}
            </DashboardLink>
          </div>
        </section>
      ) : (
        <>
          {next && workspace === "student" && (
            <NextReservation
              next={next}
              workspace={workspace}
              privateWorkflow={privateWorkflow}
            />
          )}
          <section
            id="active"
            className="family-panel"
            aria-labelledby="active-title"
          >
            <div className="family-panel-heading">
              <span className="family-panel-icon" aria-hidden="true">
                <CalendarDays size={18} />
              </span>
              <h2 id="active-title">
                {workspace === "parent"
                  ? "Upcoming Sessions"
                  : privateWorkflow
                    ? "Upcoming sessions"
                    : "Active simulated reservations"}
              </h2>
            </div>
            {next && workspace === "parent" && (
              <NextReservation
                next={next}
                workspace={workspace}
                privateWorkflow={privateWorkflow}
              />
            )}
            {!active.length && (
              <p className="family-void">
                {privateWorkflow
                  ? "No upcoming sessions. Cancelled, expired and completed bookings remain in history."
                  : "No active simulated reservations. Any expired reservation remains in history."}
              </p>
            )}
            {workspace === "student" && next && !agenda.length && (
              <p className="family-void">
                {privateWorkflow
                  ? "No other upcoming sessions."
                  : "No other active simulated reservations."}
              </p>
            )}
            <Agenda
              rows={agenda}
              workspace={workspace}
              privateWorkflow={privateWorkflow}
            />
            {data.activeHasNext && (
              <Link
                className="family-link"
                href={`/bookings?${new URLSearchParams({ scope: workspace === "parent" ? "guardian" : "student", filter: "active", ...(data.query.learner ? { learnerId: data.query.learner } : {}) })}`}
              >
                {privateWorkflow
                  ? "View all upcoming sessions"
                  : "View all active reservations"}
              </Link>
            )}
          </section>
          <section
            id="history"
            className="family-panel"
            aria-labelledby="history-title"
          >
            <div className="family-panel-heading">
              <span className="family-panel-icon" aria-hidden="true">
                <History size={18} />
              </span>
              <h2 id="history-title">
                {workspace === "parent"
                  ? "Booking History"
                  : privateWorkflow
                    ? "History"
                    : "Reservation history"}
              </h2>
            </div>
            {!history.length && (
              <p className="family-void">
                {(data.query.historyPage ?? 1) === 1
                  ? privateWorkflow
                    ? "No booking history yet. Cancelled, expired and completed bookings will appear here."
                    : "No reservation history yet. Expired simulations appear here with their original scheduled time."
                  : "No history on this page. Use the previous page to return to earlier results."}
              </p>
            )}
            <Agenda
              rows={history}
              workspace={workspace}
              privateWorkflow={privateWorkflow}
            />
            <Pagination data={data} kind="history" />
          </section>
        </>
      )}
      <Link
        href={workspace === "parent" ? "/parent/children" : "/learners"}
        className="family-link family-footer-link"
      >
        {workspace === "parent" ? "My Children" : "Your learners"}
      </Link>
      <ExpiryRefresh
        expiresAt={earliestExpiry}
        snapshotAt={data.checkedAt.startAtUtc}
      />
    </div>
  );
}
