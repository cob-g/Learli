"use client";

import { useTransition } from "react";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { levelNames } from "@/features/subjects/catalog";
import type {
  BookingLearnerSummary,
  BookingReadFilter,
  BookingReadScope,
} from "./read-model";

/** Native GET without JavaScript; enhanced navigation retains visible content. */
export function BookingHistoryFilters({
  scope,
  filter,
  pageSize,
  learners,
  learnerId,
  privateWorkflow = false,
}: {
  scope: BookingReadScope;
  filter: BookingReadFilter;
  pageSize: number;
  learners: BookingLearnerSummary[];
  learnerId?: string;
  privateWorkflow?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <form
      key={`${scope}:${filter}:${pageSize}:${learnerId ?? ""}`}
      method="get"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        const query = new URLSearchParams();
        for (const [name, value] of new FormData(event.currentTarget))
          if (typeof value === "string") query.append(name, value);
        startTransition(() => router.push(`/bookings?${query}`));
      }}
      className="mt-6 flex max-w-5xl flex-wrap items-end gap-4 rounded-surface border border-border bg-surface p-4 sm:p-6"
    >
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="pageSize" value={pageSize} />
      {scope === "guardian" && learners.length > 0 && (
        <div className="w-full min-w-0 space-y-2 sm:w-80">
          <label htmlFor="booking-learner" className="block text-label">
            Learner
          </label>
          <select
            id="booking-learner"
            className="field"
            name="learnerId"
            defaultValue={learnerId ?? ""}
          >
            <option value="">All authorized learners</option>
            {learners.map((learner) => (
              <option key={learner.id} value={learner.id}>
                {learner.displayName} · {levelNames([learner.level]).join()}
              </option>
            ))}
          </select>
        </div>
      )}
      {scope === "student" && learnerId && (
        <input type="hidden" name="learnerId" value={learnerId} />
      )}
      <div className="w-full min-w-0 space-y-2 sm:w-64">
        <label htmlFor="booking-view" className="block text-label">
          Booking view
        </label>
        <select
          id="booking-view"
          className="field"
          name="filter"
          defaultValue={filter}
        >
          <option value="all">All saved bookings</option>
          <option value="active">
            {privateWorkflow ? "Active bookings" : "Active simulations"}
          </option>
          <option value="history">Booking history</option>
        </select>
      </div>
      <button className="action action-outline" type="submit">
        Apply booking view
      </button>
      {pending && (
        <p role="status" className="w-full text-body">
          Loading your bookings…
        </p>
      )}
    </form>
  );
}

function PendingLabel({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <span aria-live="polite" aria-busy={pending}>
      {pending ? pendingLabel : label}
    </span>
  );
}
export function BookingReadLink({
  href,
  label,
  ariaLabel,
  pendingLabel = "Loading your bookings…",
}: {
  href: string;
  label: string;
  ariaLabel?: string;
  pendingLabel?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={ariaLabel}
      className="action action-outline max-w-full shrink-0 self-start"
    >
      <PendingLabel label={label} pendingLabel={pendingLabel} />
    </Link>
  );
}
