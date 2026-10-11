import Link from "next/link";

export function TutorWorkspaceNavigation() {
  return (
    <nav
      aria-label="Tutor work areas"
      className="flex flex-wrap gap-x-6 gap-y-2"
    >
      <Link
        className="inline-flex min-h-11 items-center border-b-2 border-primary text-label-strong"
        href="/tutor"
        aria-current="page"
      >
        Bookings
      </Link>
      <Link
        className="inline-flex min-h-11 items-center text-label"
        href="/tutor/availability"
      >
        Availability
      </Link>
      <Link
        className="inline-flex min-h-11 items-center text-label"
        href="/tutor/time-off"
      >
        Time off
      </Link>
      <Link
        className="inline-flex min-h-11 items-center text-label"
        href="/tutor/profile"
      >
        Profile
      </Link>
      <Link
        className="inline-flex min-h-11 items-center text-label"
        href="/account"
      >
        Account settings
      </Link>
    </nav>
  );
}
