# Local administrator screening and authenticator setup

On 2026-11-10 the owner requested that all administrators be able to claim and
approve tutor reviews for the initial workflow and that authenticator setup offer
a scannable QR. The implementation is limited to ordinary local operation;
production and real-user policy activation remain separately gated.

Active verified administrators with current MFA have local tutor-screening
access without a separate pre-grant. Explicit staff revocations remain effective.
The exact claim, no self-review, required current evidence, policy, audit and
participant privacy checks remain. Other staff capabilities remain scoped. This
does not approve a tutor or represent a real check as completed.

The setup QR is generated in the browser from the private provider URI, with a
manual key fallback. It must not be sent to an external QR provider, persisted,
logged or exposed through URLs.
