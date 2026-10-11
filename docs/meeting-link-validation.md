# Meeting-link validation

`validateMeetingLink(input: unknown)` in `src/lib/validation/meeting-link.ts`
is a synchronous, dependency-free format check. It makes no network requests,
does not log, and does not coerce non-string inputs. Success returns
`{ ok: true, provider: "zoom" | "google_meet", url: string }`; failure returns
only `{ ok: false, code: "INVALID_MEETING_LINK" }`, with no input or parser error.
The returned URL is private, including its embedded passcode if present.

## Supported technical subset

| Provider    | Host                                                     | Path                                                                                             | Query                                                                                                  |
| ----------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Zoom        | `zoom.us` or exactly one ASCII DNS label under `zoom.us` | `/j/` followed by 9–11 ASCII digits                                                              | None, or exactly one `pwd` with 1–256 unreserved ASCII characters: letters, digits, `.`, `_`, `~`, `-` |
| Google Meet | Exactly `meet.google.com`                                | Three nonempty lowercase ASCII letter groups separated by hyphens; total code length at most 128 | None                                                                                                   |

Zoom subdomain labels are 1–63 characters, start/end with a letter or digit,
allow internal hyphens, and cannot start with `xn--`. This covers regional
hosts such as `us02web.zoom.us` and organization hosts such as
`example-school.zoom.us`; it does not verify that any particular host exists.

Only absolute `https://` URLs are accepted. Scheme and host are case-insensitive
and normalized to lowercase. Path and `pwd` case/bytes are preserved; no token
is decoded, removed or rebuilt. Revalidating the returned URL gives the same
result. Total input length is capped at 2048 characters before parsing.

Reject whitespace (including around the URL), controls, non-ASCII characters,
backslashes, percent escapes, userinfo, explicit ports (even `:443`), fragments
(even empty `#`), trailing dots, trailing slashes and extra path segments.
Compare raw and parsed paths to reject dot-segment repair. Reject empty `?`,
unknown/duplicate parameters and encoded parameter names rather than silently
discarding parts of an invitation.

This intentionally supports fewer forms than the providers. Not supported:
Zoom `/my/` personal aliases, `/s/` host links, `/wc/` browser links, registration,
webinar and recording paths, `zoom.com`/`zoomgov.com` and other alternate domains;
Meet `/lookup/` nicknames, creation/landing pages and account-selection paths;
extra queries such as `omn`, `tk`, `authuser`, `hs` or tracking parameters.
An unsupported result does not prove a provider URL is malicious. Obtain a
supported joining URL; do not automatically strip credentials or query fields.
Expand the subset only with official evidence and security regression tests.

## Official evidence

Checked 2026-10-11; only public documentation was fetched, never a meeting URL.

- [Zoom joining with an invite link](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0065180)
  describes meeting IDs and optional embedded passcodes.
- [Zoom recurring meeting access](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0082196)
  documents the `/j/MEETING-ID` form and 9, 10 or 11 digits.
- [Zoom vanity URL guidelines](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0061540)
  documents organization subdomains; DNS label checks here are technical syntax,
  not verification that Zoom approved an organization.
- [Zoom Meetings API examples](https://developers.zoom.us/docs/api/meetings/)
  show numeric invitation URLs and `pwd` tokens including a dot.
- [Google Meet spaces reference](https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces)
  specifies `https://meet.google.com/` plus a meeting code, grammar
  `[a-z]+-[a-z]+-[a-z]+`, maximum length 128. The familiar `abc-mnop-xyz`
  is an example, not the only length accepted here.

The size bound, token alphabet/limit, raw-input restrictions, query allowlist and
excluded variants are Learli engineering choices, not provider guarantees or
new business/safeguarding policy.

## Future integration and unresolved policy

This completes only the validation-library portion of M5.1 / MEET-01. It neither
implements M5.1's protected storage/mutation nor M5.2's participant access.

1. Product/founder must decide per-booking versus approved reusable links,
   link access timing, guardian/supervision rules and meeting-safety settings.
   Accepting a numeric PMI format does not approve reuse. Optional `pwd` does
   not approve meetings without passcodes or establish that a passcode works.
2. Once booking and participant ownership exist, invoke this function on the
   server for submissions. Authenticate and authorize each write/read against
   that exact booking or approved protected setting and its status.
3. Persist only the successful `url` and provider through that private boundary.
   Never log the input/result, include links in public profiles, metadata,
   analytics or shared caches, or send them to unrelated recipients.
4. Add cross-account/guardian/tutor denial tests, private-output tests and honest
   missing-link UI. Client validation may assist input but cannot enforce access.

Syntax acceptance establishes no meeting existence, host ownership, invitation,
participant authorization, provider safety settings, meeting completion or
attendance. There is no fetching, DNS lookup, redirect following, OAuth/API,
video, storage, booking integration or UI in this library.
