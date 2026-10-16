"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { z } from "zod";
import { learnerLevelOptions } from "@/features/subjects/catalog";
import { describeLearnerIssues } from "@/features/learners/input";
import { admissionInput } from "./input";
import {
  clearRequestId,
  isUncertainRequestStatus,
  rememberRequestId,
  requestFingerprint,
  reusableRequestId,
} from "@/features/learners/pending-request";
import type { ReviewerAdmissionDetail } from "./service";
const admissionScope = "learner-admission";
const responseMessage = z.object({
  message: z.string().max(500).optional(),
  fields: z.record(z.string(), z.string().max(500)).optional(),
});
const responseId = z.object({ id: z.uuid() });
function useSubmission() {
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const notice = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!message) return;
    const first = [
      "displayName",
      "level",
      "timezone",
      "checkCode",
      "reference",
    ].find((name) => fields[name]);
    const target = first
      ? notice.current
          ?.closest("form")
          ?.querySelector<HTMLElement>(`[name="${first}"]`)
      : null;
    (target ?? notice.current)?.focus();
  }, [message, fields]);
  async function submit(
    url: string,
    body: unknown,
    track?: { fingerprint: string; id: string },
  ) {
    setPending(true);
    setMessage("");
    setFields({});
    if (track) rememberRequestId(admissionScope, track.fingerprint, track.id);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const value: unknown = await response.json();
      if (!response.ok) {
        if (track && isUncertainRequestStatus(response.status)) {
          setUncertain(true);
          setMessage(
            "The result is uncertain. Reload the current status before another request.",
          );
          return null;
        }
        if (track) clearRequestId(admissionScope);
        const parsed = responseMessage.safeParse(value);
        const safe = parsed.success ? parsed.data : {};
        setMessage(
          safe.message ||
            "This request is unavailable. Reload its current status.",
        );
        setFields(safe.fields || {});
        return null;
      }
      const result = responseId.parse(value);
      if (track) clearRequestId(admissionScope);
      return result;
    } catch {
      setUncertain(true);
      setMessage(
        "The result is uncertain. Reload the current status before another request.",
      );
      return null;
    } finally {
      setPending(false);
    }
  }
  const feedback = (
    <>
      <noscript>
        <p className="mt-4 text-body">
          Enable JavaScript to send this private request. Details are never
          submitted in a URL.
        </p>
      </noscript>
      {message && (
        <p ref={notice} role="alert" tabIndex={-1} className="mt-4 text-body">
          {message}
        </p>
      )}
      {pending && (
        <p role="status" className="mt-4 text-body">
          Saving request.
        </p>
      )}
    </>
  );
  return {
    submit,
    disabled: !hydrated || pending || uncertain,
    feedback,
    fields,
    setFields,
    setMessage,
  };
}
export function AdmissionForm({
  requestId,
  policyVersion,
  policyDigest,
  zones,
  next,
  privateWorkflow = false,
  initialManagement = "guardian",
}: {
  requestId: string;
  policyVersion: string;
  policyDigest: string;
  zones: { value: string; label: string }[];
  next?: string;
  privateWorkflow?: boolean;
  initialManagement?: "guardian" | "self";
}) {
  const [management, setManagement] = useState<"guardian" | "self">(
    initialManagement,
  );
  const state = useSubmission();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const fields = {
      policyVersion,
      policyDigest,
      management,
      displayName: fd.get("displayName"),
      level: management === "self" ? "college_support" : fd.get("level"),
      timezone: fd.get("timezone"),
      ...(next ? { next } : {}),
    };
    const fingerprint = requestFingerprint(fields);
    const id = reusableRequestId(admissionScope, fingerprint, requestId);
    const input = { requestId: id, ...fields };
    const parsed = admissionInput.safeParse(input);
    if (!parsed.success) {
      const issues = describeLearnerIssues(parsed.error);
      state.setFields(issues.fields);
      state.setMessage(issues.message);
      const first = Object.keys(issues.fields)[0];
      form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    const result = await state.submit("/api/learner-admission", parsed.data, {
      fingerprint,
      id,
    });
    if (result) window.location.replace(`/learner-admission/${result.id}`);
  }
  return (
    <form
      method="post"
      action="/api/learner-admission"
      onSubmit={save}
      className="max-w-prose space-y-6"
    >
      <fieldset disabled={state.disabled} className="space-y-6">
        <legend className="text-section-title">
          {privateWorkflow
            ? "Learner admission request"
            : "Synthetic admission request"}
        </legend>
        <div>
          <label htmlFor="management" className="text-label">
            Request type
          </label>
          <select
            id="management"
            className="field mt-2"
            value={management}
            onChange={(e) =>
              setManagement(e.target.value === "self" ? "self" : "guardian")
            }
          >
            <option value="guardian">Guardian-managed learner</option>
            <option value="self">Independent College Support</option>
          </select>
        </div>
        <div>
          <label className="text-label" htmlFor="displayName">
            {privateWorkflow
              ? "Learner display name"
              : "Fictional display name"}
          </label>
          <input
            id="displayName"
            name="displayName"
            className="field mt-2"
            maxLength={80}
            aria-invalid={!!state.fields.displayName}
            aria-describedby={
              state.fields.displayName ? "displayName-error" : undefined
            }
          />
          {state.fields.displayName && (
            <p id="displayName-error" className="mt-2 text-body text-error">
              {state.fields.displayName}
            </p>
          )}
        </div>
        {management === "guardian" ? (
          <div>
            <label className="text-label" htmlFor="level">
              Learner level
            </label>
            <select id="level" name="level" className="field mt-2">
              {learnerLevelOptions.map((level) => (
                <option key={level[0]} value={level[0]}>
                  {level[1]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-body">
            {privateWorkflow
              ? "College Support. An assigned reviewer must confirm independent eligibility before booking access is available."
              : "College Support. Independent eligibility needs separate reviewer evidence; no guardian is required."}
          </p>
        )}
        <div>
          <label htmlFor="timezone" className="text-label">
            Time zone
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue="UTC"
            className="field mt-2"
          >
            {zones.map((zone) => (
              <option value={zone.value} key={zone.value}>
                {zone.label}
              </option>
            ))}
          </select>
        </div>
        <button
          className="action action-primary w-full transition-none sm:w-auto"
          type="submit"
        >
          Request admission review
        </button>
      </fieldset>
      {state.feedback}
    </form>
  );
}
export function AdmissionReviewForms({
  admission,
  privateWorkflow = false,
}: {
  admission: ReviewerAdmissionDetail;
  privateWorkflow?: boolean;
}) {
  const state = useSubmission();
  const [confirm, setConfirm] = useState(false);
  async function submit(
    event: FormEvent<HTMLFormElement>,
    kind: "evidence" | "decision" | "revoke-evidence",
  ) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const requestId = crypto.randomUUID();
    const body = {
      requestId,
      revision: admission.revision,
      ...(kind === "evidence"
        ? { checkCode: fd.get("checkCode"), reference: fd.get("reference") }
        : kind === "decision"
          ? { action: fd.get("action") }
          : { evidenceId: fd.get("evidenceId") }),
    };
    const result = await state.submit(
      `/api/admin/learner-admission/${admission.id}/${kind}`,
      body,
    );
    if (result)
      window.location.replace(`/admin/learner-admission/${admission.id}`);
  }
  return (
    <div className="mt-8 max-w-prose space-y-8">
      {admission.state === "pending" && (
        <form
          method="post"
          action={`/api/admin/learner-admission/${admission.id}/evidence`}
          onSubmit={(e) => submit(e, "evidence")}
        >
          <fieldset disabled={state.disabled} className="space-y-4">
            <legend className="text-section-title">
              {privateWorkflow
                ? "Record test evidence"
                : "Record synthetic evidence"}
            </legend>
            <div>
              <label htmlFor="checkCode" className="text-label">
                Review check
              </label>
              <select className="field mt-2" name="checkCode" id="checkCode">
                {(admission.management === "guardian"
                  ? [
                      ["guardian_authority", "Guardian authority"],
                      ["guardian_notice", "Guardian notice"],
                    ]
                  : [["independent_eligibility", "Independent eligibility"]]
                ).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="reference" className="text-label">
                {privateWorkflow
                  ? "Opaque test reference"
                  : "Opaque synthetic reference"}
              </label>
              <input
                id="reference"
                name="reference"
                className="field mt-2"
                required
                maxLength={128}
                pattern="[A-Za-z0-9:_-]+"
                aria-describedby="reference-help"
              />
              <p id="reference-help" className="mt-2 text-caption">
                Use a fictional token. Enter no contact details, URLs or
                document content.
              </p>
            </div>
            <button
              type="submit"
              className="action action-outline transition-none"
            >
              Record evidence
            </button>
          </fieldset>
        </form>
      )}
      {admission.evidence.length > 0 && (
        <section>
          <h2 className="text-section-title">Recorded checks</h2>
          <ul className="mt-4 divide-y divide-border">
            {admission.evidence.map((e) => (
              <li key={e.id} className="py-4">
                <p className="text-body wrap-anywhere">
                  {e.checkCode.replaceAll("_", " ")}: {e.reference}.{" "}
                  {e.revoked ? "Revoked" : "Recorded"}
                </p>
                {!e.revoked && (
                  <form
                    method="post"
                    onSubmit={(event) => submit(event, "revoke-evidence")}
                    action={`/api/admin/learner-admission/${admission.id}/revoke-evidence`}
                  >
                    <input type="hidden" name="evidenceId" value={e.id} />
                    <label className="flex min-h-11 items-center gap-3 text-body">
                      <input
                        type="checkbox"
                        required
                        disabled={state.disabled}
                      />
                      Remove this evidence and any current learner access it
                      supports.
                    </label>
                    <button
                      disabled={state.disabled}
                      className="action action-outline mt-2 transition-none"
                    >
                      Revoke evidence and current access
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {(admission.state === "pending" || admission.state === "authorized") && (
        <form
          method="post"
          action={`/api/admin/learner-admission/${admission.id}/decision`}
          onSubmit={(e) => submit(e, "decision")}
        >
          <fieldset disabled={state.disabled} className="space-y-4">
            <legend className="text-section-title">Admission decision</legend>
            {admission.state === "pending" ? (
              <div>
                <label className="text-label" htmlFor="action">
                  Decision
                </label>
                <select name="action" id="action" className="field mt-2">
                  <option value="authorize">
                    {privateWorkflow
                      ? "Authorize test learner access"
                      : "Authorize synthetic admission"}
                  </option>
                  <option value="reject">Reject request</option>
                </select>
              </div>
            ) : (
              <>
                <input type="hidden" name="action" value="revoke" />
                <label className="flex min-h-11 items-center gap-3 text-body">
                  <input
                    type="checkbox"
                    checked={confirm}
                    onChange={(e) => setConfirm(e.target.checked)}
                  />
                  Remove current learner and guardian access. Keep the decision
                  history.
                </label>
              </>
            )}
            <button
              disabled={admission.state === "authorized" && !confirm}
              className="action action-primary transition-none"
            >
              {admission.state === "authorized"
                ? "Revoke admission"
                : "Save admission decision"}
            </button>
          </fieldset>
        </form>
      )}
      {state.feedback}
    </div>
  );
}
