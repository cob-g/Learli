# Dedicated workspace presentation — 2026-10-14

The owner approved same-tab dedicated workspaces for the existing parent,
student, tutor and administrator routes. Workspace pages have no public landing
navbar, marketing mobile dock or footer. This latest explicit no-footer choice
supersedes the earlier all-pages footer/header visual rule. Public marketing and
account-access pages retain their public shell.

One root document keeps shared providers and metadata; route-group layouts own
their chrome and main landmark. A solid desktop sidebar and compact account bar
become an accessible disclosure menu on mobile, using existing Learli tokens.
The existing guarded account read supplies navigation grants. A current role
requires an actual grant: explicit role routes win, same-document shared
destinations retain the selected role, and a sole grant resolves a direct shared
entry. A fresh ambiguous multi-role entry stays neutral. Role context lives only
inside the current provider user/session; there is no durable role storage. Role switching selects an existing workspace without
changing permissions. Visit website remains a secondary same-tab link, and
parent/student accounts keep Find a tutor. Existing admin work areas stay visible
within the dedicated navigation, without a second sidebar.

Each destination rechecks the guarded account GET, which already authorizes the
current server session/account/roles, without a second route-triggered provider
request. Only display links survive same-identity navigation waits; unchecked
names are hidden. Provider refresh/error, identity/session change and account
failure clear evidence; outdated requests are discarded. This correction follows
the owner's sidebar-changing bug report on2026-10-14 and supersedes the earlier
neutral-shared/all-pending rule. Duplicate inline tutor chrome is removed while
contextual prerequisite and recovery actions remain. Existing server authorization, admin assurance, private
no-index/document boundaries, record ownership and signout document replacement
remain authoritative. No policy, schema, endpoint, dependency or infrastructure
change. Real-use and production gates are unchanged.

Blueprint: `prompts/features/m1-05-workspace-shell.md`, AUTHORIZED — build-feature
delegation from the owner's request, not separate approval of the written plan.
Verification belongs in the progress tracker and ignored worker report.

Sidebar refresh detail: a selected role enum may survive an ordinary provider
refresh within the same user/session, but no name or granted-role links display
until fresh guarded account data validates it. Error/denial and identity/session
changes clear the context. Shared booking current-page markers require the exact
matching scope; query scope never grants or selects an arbitrary workspace.

## Amendment, 2026-10-14: full sidebar at first paint

The owner reported that the admin sidebar first appeared with only the shared
links and filled in after a delay, and asked for one complete sidebar at once.
Cause: role links waited for two browser requests in sequence (provider session,
then the guarded account GET), about 1.2 s on the development database. The
workspace layout now performs the same guarded account read on the server
(`readShellAccount`), so the first paint has the full sidebar and name and that
first visit needs no account GET. The server's account is shown only while the
provider session first loads and is kept only if it settles to the same user
and session; sign-out, errors, another user or session discard it. Later
destinations recheck as before. Better Auth also flags its first load as
refetching; only a refresh of a settled session discards the shown account.

## Amendment, 2026-10-14: no flicker during re-checks

The owner approved keeping the account name and role links visible while a
re-check of the same user and session is pending: a sidebar navigation's guarded
account read, a provider refresh on tab focus, visibility or online, the
account-updated event, and the public header's per-navigation session refetch.
Previously the name disappeared for 0.7–1.3 s on every sidebar click, and the
role links vanished on every tab return. A settled read replaces what is shown;
a failed or denied read, a provider error, sign-out or a different user or
session still clears it at once. Server guards remain authoritative, so a link
shown for about a second after a role is revoked cannot grant anything. This
supersedes the "only display links survive navigation waits" and "no name or
granted-role links display until fresh data validates it" rules above.
