# Recovery — Neon post-deploy status inspection

Status: **RESOLVED BY SEPARATE VERIFY — AUTHORIZED — build-feature delegation**.
Mode: Targeted Fix / external authentication-path investigation.
Environment: authorized Neon project operational setup, baseline main
`2fa0294c5e6cad895754b3c10a703a6c6f6ef00a`.
Blueprint: `prompts/features/m8-03-neon-project-setup.md`; M8.3 / NFR-11.

## Expected versus observed

After successful `neon deploy --no-env-pull -o json` with only a branch noop,
read-only status and dry-run should confirm preserved live configuration.
The initial post-deploy `neon config status -o json` produced empty stdout and
rejected the OAuth Bearer credential during `getNeonDataApi` inspection
(request ID `07458bae-1618-4833-b237-377b835c4120`). The immediately following
`neon config plan -o json` succeeded with the same target and only a branch noop.
The combined shell invocation's final exit code does not establish status success;
the empty receipt is explicitly a failed check.

## Diagnosis and confidence

Observed: original browser login completed; authenticated target/link/config
reads, plan and deploy succeeded; one subsequent inspection failed at a
service-specific API authentication boundary. No failed deploy or data mutation
is indicated. Exact root cause (expiry, refresh behavior or service-path auth)
is not yet established. Do not claim expiry as proven or start a duplicate login.
The verification helper then failed parsing the missing status JSON, before
writing its final evidence. Earlier local read-only DB checks had succeeded.

Two preparation helper mistakes also require transparent retained evidence:
an incorrect deep import of add-mcp's CLI entry was corrected to its actual
library export before MCP execution, and a redundant attempt to pin nonexistent
`@neon/env@0.16.3` failed with ETARGET. The actual initializer already pinned
`@neon/env` 1.5.3 and `@neon/config` 1.8.6; no package version change resulted.
Python's default runtime lacked tomllib; Python 3.14 parsed the backed-up Codex
TOML and confirmed all unrelated settings preserved.

## Recommended separate implementation/verification action

Retain original receipts. Retry only read-only status after checking current
authentication. If the browser credential path still fails, reuse the already
authorized MCP-installed API key privately through subprocess environment for
this one inspection; do not mint/rotate/revoke credentials or print values.
Confirm response binds the exact named project and production branch; compare
live config before/after and rerun the preservation evidence helper.
No production SQL, config mutation, reset, seed, or deployment retry is needed.

Recovery writes only this handoff; checks are NOT RUN BY RECOVER. Return to
build-feature for scoped execution, Review and separate Verify. The operational
deployment receipt remains observed success; final workflow verification remains
pending until the missing post-deploy status evidence is resolved.

## Observed resolution

The separate Verify stage ran `neon me -o json`, then retried
`neon config status -o json`; both succeeded with the original authenticated
account. The retried status binds the exact production branch and its live
config equals the pre-deploy snapshot. No alternate key, duplicate login,
rotation, provider mutation or deploy retry was required. The original
service-specific authentication failure remains recorded; its exact cause is
unproven. The separate preservation helper now passes against the retried status,
both byte-identical env files, both 22-migration loopback DBs and all ten canonical
skill links. Evidence is private under `.local/neon-setup/`.
