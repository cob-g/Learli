"use client";

import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function LoadingTutorBookings() {
  return (
    <p role="status" className="mt-2 text-body">
      Loading your assigned bookings…
    </p>
  );
}

/** Native GET remains usable without scripts; refresh announces a client transition. */
export function TutorBookingRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function refresh(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(() => router.refresh());
  }
  return (
    <form action="/tutor" method="get" onSubmit={refresh} aria-busy={pending}>
      <button
        className="action action-outline tutor-refresh"
        type="submit"
        disabled={pending}
      >
        <RefreshCw size={15} aria-hidden="true" />
        Refresh bookings
      </button>
      {pending && <LoadingTutorBookings />}
    </form>
  );
}
