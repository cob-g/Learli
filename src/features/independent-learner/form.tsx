"use client";

import Link from "next/link";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  clearRequestId,
  isUncertainRequestStatus,
  rememberRequestId,
  requestFingerprint,
  reusableRequestId,
} from "@/features/learners/pending-request";
import type { TimeZoneOption } from "@/lib/time/zones";

const pendingScope = "independent-learner-v2";

export function IndependentLearnerForm({
  requestId,
  policyVersion,
  policyDigest,
  noticeVersion,
  timezone,
  zones,
  next,
}: {
  requestId: string;
  policyVersion: string;
  policyDigest: string;
  noticeVersion: string;
  timezone: string;
  zones: TimeZoneOption[];
  next?: string;
}) {
  const ready = useHydrated();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [created, setCreated] = useState(false);
  const busy = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (notice)
      (
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
        noticeRef.current
      )?.focus();
  }, [notice, fields]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy.current) return;
    const data = new FormData(event.currentTarget);
    const payload = {
      displayName: String(data.get("displayName") ?? "").trim(),
      timezone: data.get("timezone"),
      policyVersion,
      policyDigest,
      noticeVersion,
      eligibilityDeclared: data.get("eligibilityDeclared") === "on",
      ...(next ? { next } : {}),
    };
    busy.current = true;
    setPending(true);
    setFields({});
    setNotice("");
    try {
      // Store only an opaque digest and request key; never retain declaration text.
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(requestFingerprint(payload)),
      );
      const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const id = reusableRequestId(pendingScope, fingerprint, requestId);
      rememberRequestId(pendingScope, fingerprint, id);
      const response = await fetch("/api/student/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, ...payload }),
      });
      const result: unknown = await response.json();
      if (
        response.ok &&
        typeof result === "object" &&
        result !== null &&
        "state" in result &&
        result.state === "authorized" &&
        "verificationStatus" in result &&
        result.verificationStatus === "self_attested_unverified" &&
        "id" in result &&
        typeof result.id === "string" &&
        /^[0-9a-f-]{36}$/i.test(result.id) &&
        "admissionId" in result &&
        typeof result.admissionId === "string" &&
        /^[0-9a-f-]{36}$/i.test(result.admissionId)
      ) {
        clearRequestId(pendingScope);
        setCreated(true);
        setNotice(
          "College Student profile created. You can now arrange tutoring from your Student workspace.",
        );
        return;
      }
      const body =
        typeof result === "object" && result !== null
          ? (result as {
              message?: unknown;
              fields?: unknown;
            })
          : {};
      const uncertain =
        response.ok || isUncertainRequestStatus(response.status);
      if (!uncertain) clearRequestId(pendingScope);
      setFields(
        body.fields && typeof body.fields === "object"
          ? (body.fields as Record<string, string>)
          : {},
      );
      setNotice(
        uncertain
          ? "We could not confirm whether your profile was created. Check your account, or keep the same details and retry safely."
          : typeof body.message === "string"
            ? body.message
            : "College Student setup could not be completed. Check your details and try again.",
      );
      busy.current = false;
    } catch {
      setNotice(
        "We could not confirm whether your profile was created. Check your account, or keep the same details and retry safely.",
      );
      busy.current = false;
    } finally {
      setPending(false);
    }
  }

  function error(key: string) {
    return fields[key] ? (
      <p id={`${key}-error`} className="text-small text-error">
        {fields[key]}
      </p>
    ) : null;
  }

  function nativeNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.location.assign(event.currentTarget.href);
  }

  return (
    <form
      ref={formRef}
      className="mt-8 max-w-xl space-y-5"
      onSubmit={save}
      method="post"
      action="/api/student/profile"
      noValidate
      aria-busy={pending}
      aria-label="College Student profile"
    >
      <noscript>
        <p className="text-body">
          Enable JavaScript to create your College Student profile.
        </p>
      </noscript>
      {!created && (
        <>
          <div className="space-y-2">
            <label className="block text-label" htmlFor="displayName">
              Display name
            </label>
            <input
              className="field"
              id="displayName"
              name="displayName"
              required
              maxLength={80}
              autoComplete="name"
              disabled={!ready || pending}
              aria-invalid={!!fields.displayName}
              aria-describedby={
                fields.displayName ? "displayName-error" : undefined
              }
            />
            {error("displayName")}
          </div>
          <div className="space-y-2">
            <label className="block text-label" htmlFor="timezone">
              Time zone
            </label>
            <select
              className="field"
              id="timezone"
              name="timezone"
              defaultValue={timezone}
              disabled={!ready || pending}
              aria-invalid={!!fields.timezone}
              aria-describedby={fields.timezone ? "timezone-error" : undefined}
            >
              {zones.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {error("timezone")}
          </div>
          <fieldset
            className="space-y-3 border-t border-border pt-5"
            disabled={!ready || pending}
          >
            <legend className="text-label">Independent eligibility</legend>
            <label
              className="flex min-h-11 items-start gap-3 text-body"
              htmlFor="eligibilityDeclared"
            >
              <input
                className="mt-1 size-5 shrink-0 accent-primary"
                id="eligibilityDeclared"
                name="eligibilityDeclared"
                type="checkbox"
                required
                aria-invalid={!!fields.eligibilityDeclared}
                aria-describedby={`eligibility-help${fields.eligibilityDeclared ? " eligibilityDeclared-error" : ""}`}
              />
              <span>
                I confirm that I am an adult or otherwise legally eligible to
                manage this tutoring account independently.
              </span>
            </label>
            {error("eligibilityDeclared")}
            <p
              id="eligibility-help"
              className="text-small text-muted-foreground"
            >
              This is your self-declaration. Learli does not treat it as
              verified proof of age, identity or legal eligibility. College
              Support is an education level and does not establish adulthood.
            </p>
          </fieldset>
        </>
      )}
      {notice && (
        <p
          ref={noticeRef}
          tabIndex={-1}
          role={created ? "status" : "alert"}
          className={`flex items-start gap-2 text-body ${created ? "text-success" : "text-error"}`}
        >
          {created ? (
            <CircleCheck className="mt-1 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <CircleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />
          )}
          {notice}
        </p>
      )}
      {created ? (
        <div className="flex flex-wrap gap-4">
          {next && (
            <Link
              className="action action-primary"
              href={next}
              prefetch={false}
              onClick={nativeNavigation}
            >
              Continue to booking
            </Link>
          )}
          <Link
            className={next ? "action action-outline" : "action action-primary"}
            href="/student"
            prefetch={false}
            onClick={nativeNavigation}
          >
            Student Dashboard
          </Link>
        </div>
      ) : (
        <button
          className="action action-primary"
          type="submit"
          disabled={!ready || pending}
        >
          {pending && (
            <LoaderCircle
              className="size-4 motion-safe:animate-spin"
              aria-hidden="true"
            />
          )}
          {pending ? "Creating profile…" : "Create Student profile"}
        </button>
      )}
    </form>
  );
}
