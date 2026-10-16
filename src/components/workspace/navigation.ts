import type { Role } from "@/lib/db/schema/app";
import { adminAreas } from "@/features/admin/admin-shell";

export const workspaceLabels: Record<Role, string> = {
  parent: "Parent workspace",
  student: "Student workspace",
  tutor: "Tutor workspace",
  admin: "Admin workspace",
};
export type WorkspaceLink = {
  href: string;
  label: string;
  exact?: boolean;
  exclude?: string;
};

/** Display context only; explicit role paths never fall back to another role. */
export function currentWorkspace(
  pathname: string,
  roles: readonly Role[],
  previous: Role | null = null,
): Role | null {
  const explicit = (Object.keys(workspaceLabels) as Role[]).find(
    (role) => pathname === `/${role}` || pathname.startsWith(`/${role}/`),
  );
  if (explicit) return roles.includes(explicit) ? explicit : null;
  const shared = [
    "/account",
    "/bookings",
    "/learners",
    "/learner-admission",
    "/safeguarding",
    "/support",
  ].some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!shared) return null;
  if (previous && roles.includes(previous)) return previous;
  return roles.length === 1 ? roles[0] : null;
}
/** Deployment-level switches; never per user, so the sidebar cannot flash. */
export type WorkspaceLinkOptions = {
  screening?: boolean;
  privateWorkflow?: boolean;
  privateAccounts?: boolean;
};
export function workspaceLinks(
  role: Role | null,
  {
    screening = false,
    privateWorkflow = false,
    privateAccounts = false,
  }: WorkspaceLinkOptions = {},
): WorkspaceLink[] {
  switch (role) {
    case "parent":
    case "student":
      return [
        { href: `/${role}`, label: "Bookings", exact: true },
        { href: "/learners", label: "Learners" },
        ...(privateWorkflow
          ? [
              { href: "/learner-admission", label: "Learner requests" },
              { href: "/bookings/new", label: "Book a session", exact: true },
            ]
          : []),
      ];
    case "tutor":
      return [
        { href: "/tutor", label: "Bookings", exact: true },
        { href: "/tutor/availability", label: "Availability" },
        { href: "/tutor/time-off", label: "Time off" },
        { href: "/tutor/profile", label: "Profile" },
        ...(screening
          ? [{ href: "/tutor/screening", label: "Tutor screening" }]
          : []),
      ];
    case "admin":
      return [
        { href: "/admin", label: "Overview", exact: true },
        ...(privateWorkflow
          ? [{ href: "/admin/bookings", label: "Assigned bookings" }]
          : []),
        ...adminAreas
          .filter(
            ([area]) =>
              !privateWorkflow ||
              !["reviews", "publication-reviews", "accounts"].includes(area) ||
              (area === "accounts" && privateAccounts),
          )
          .map(([area, href, label]) => ({
            href,
            label: privateWorkflow && area === "accounts" ? "Accounts" : label,
            exclude:
              href === "/admin/support" ? "/admin/support/dispatch" : undefined,
          })),
        { href: "/admin/support/dispatch", label: "Support assignment" },
        {
          href: "/admin/learner-admission",
          label: "Learner admission reviews",
        },
        ...(!privateWorkflow
          ? [{ href: "/admin/safeguarding", label: "Safeguarding cases" }]
          : []),
      ];
    default:
      return [];
  }
}
export function isCurrentLink(
  pathname: string,
  link: WorkspaceLink,
  scope?: string | null,
) {
  const bookingScope =
    link.href === "/parent"
      ? "guardian"
      : link.href === "/student"
        ? "student"
        : link.href === "/tutor"
          ? "tutor"
          : null;
  if (
    bookingScope &&
    (pathname === "/bookings" || pathname.startsWith("/bookings/"))
  )
    return scope === bookingScope;
  if (
    link.exclude &&
    (pathname === link.exclude || pathname.startsWith(`${link.exclude}/`))
  )
    return false;
  return (
    pathname === link.href ||
    (!link.exact && pathname.startsWith(`${link.href}/`))
  );
}
