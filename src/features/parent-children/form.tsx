"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useHydrated } from "@/hooks/use-hydrated";
import { learnerLevelOptions } from "@/features/subjects/catalog";
import { GradeField, formGrade } from "@/features/learners/grade-field";
import {
  clearRequestId,
  isUncertainRequestStatus,
  rememberRequestId,
  requestFingerprint,
  reusableRequestId,
} from "@/features/learners/pending-request";
import type { TimeZoneOption } from "@/lib/time/zones";

const pendingScope = "parent-child";
const fieldNames = [
  "displayName",
  "level",
  "grade",
  "timezone",
  "guardianConfirmed",
  "consentConfirmed",
] as const;

export function ParentChildForm({
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
  const [level, setLevel] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<string | null>(null);
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
      level: data.get("level"),
      grade: level === "college_support" ? null : formGrade(data.get("grade")),
      timezone: data.get("timezone"),
      policyVersion,
      policyDigest,
      noticeVersion,
      guardianConfirmed: data.get("guardianConfirmed") === "on",
      consentConfirmed: data.get("consentConfirmed") === "on",
      ...(next ? { next } : {}),
    };
    busy.current = true;
    setPending(true);
    setFields({});
    setNotice("");
    try {
      // Persist only a digest and request key, never child details or consent text.
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(requestFingerprint(payload)),
      );
      const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const id = reusableRequestId(pendingScope, fingerprint, requestId);
      rememberRequestId(pendingScope, fingerprint, id);
      const response = await fetch("/api/parent/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, ...payload }),
      });
      const result = await response.json();
      if (
        response.ok &&
        result.state === "authorized" &&
        typeof result.id === "string" &&
        /^[0-9a-f-]{36}$/i.test(result.id)
      ) {
        clearRequestId(pendingScope);
        setCreated(result.id);
        setNotice(
          "Child added successfully. You can now book tutoring for this child.",
        );
      } else {
        const uncertain =
          response.ok || isUncertainRequestStatus(response.status);
        if (!uncertain) clearRequestId(pendingScope);
        const errors: Record<string, string> = {};
        for (const key of fieldNames)
          if (typeof result.fields?.[key] === "string")
            errors[key] = result.fields[key];
        setFields(errors);
        setNotice(
          uncertain
            ? "We could not confirm whether your child was saved. Check My Children, or keep the same details and retry safely."
            : response.status === 401 || response.status === 403
              ? "Sign in to your verified Parent account to add a child. Your entered details are still here."
              : response.status === 409
                ? "This request has changed or is no longer current. Check My Children before reopening Add Child."
                : response.status === 422 || response.status === 400
                  ? "Your child could not be saved. Check the highlighted fields and both confirmations, then try again."
                  : "Your child could not be saved. Check your account access and try again.",
        );
        busy.current = false;
      }
    } catch {
      setNotice(
        "We could not confirm whether your child was saved. Check My Children, or keep the same details and retry safely.",
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
      action="/api/parent/children"
      noValidate
      aria-busy={pending}
    >
      <noscript>
        <p className="text-body">
          Enable JavaScript to save a child profile. You can still view My
          Children.
        </p>
      </noscript>
      {!created && (
        <>
          <p className="text-small text-muted-foreground">
            Display name, education level and time zone are required. Grade is
            optional. Do not enter a school, address or other unnecessary
            personal information.
          </p>
          <div className="space-y-2">
            <label className="block text-label" htmlFor="displayName">
              Child’s display name
            </label>
            <input
              className="field"
              id="displayName"
              name="displayName"
              required
              maxLength={80}
              autoComplete="off"
              disabled={!ready || pending}
              aria-invalid={!!fields.displayName}
              aria-describedby={
                fields.displayName ? "displayName-error" : undefined
              }
            />
            {error("displayName")}
          </div>
          <div className="space-y-2">
            <label className="block text-label" htmlFor="level">
              Education level
            </label>
            <select
              className="field"
              id="level"
              name="level"
              required
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              disabled={!ready || pending}
              aria-invalid={!!fields.level}
              aria-describedby={fields.level ? "level-error" : undefined}
            >
              <option value="">Choose a level</option>
              {learnerLevelOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {error("level")}
          </div>
          {level !== "college_support" && (
            <GradeField disabled={!ready || pending} error={fields.grade} />
          )}
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
            className="space-y-4 border-t border-border pt-5"
            disabled={!ready || pending}
          >
            <legend className="text-label">
              Parent or guardian confirmation
            </legend>
            <label
              className="flex min-h-11 items-start gap-3 text-body"
              htmlFor="guardianConfirmed"
            >
              <input
                className="mt-1 size-5 shrink-0 accent-primary"
                id="guardianConfirmed"
                name="guardianConfirmed"
                type="checkbox"
                required
                aria-invalid={!!fields.guardianConfirmed}
                aria-describedby={
                  fields.guardianConfirmed
                    ? "guardianConfirmed-error"
                    : undefined
                }
              />
              <span>
                I confirm that I am this child’s parent or authorized guardian.
              </span>
            </label>
            {error("guardianConfirmed")}
            <label
              className="flex min-h-11 items-start gap-3 text-body"
              htmlFor="consentConfirmed"
            >
              <input
                className="mt-1 size-5 shrink-0 accent-primary"
                id="consentConfirmed"
                name="consentConfirmed"
                type="checkbox"
                required
                aria-invalid={!!fields.consentConfirmed}
                aria-describedby={`consent-help${fields.consentConfirmed ? " consentConfirmed-error" : ""}`}
              />
              <span>
                I consent to creating and managing this private child profile
                and arranging tutoring for this child through Learli.
              </span>
            </label>
            {error("consentConfirmed")}
            <p id="consent-help" className="text-small text-muted-foreground">
              This creates a new child profile. It does not link or grant access
              to an existing student account.
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
            href="/parent/children"
            prefetch={false}
            onClick={nativeNavigation}
          >
            My Children
          </Link>
          <Link
            className="action action-outline"
            href="/parent"
            prefetch={false}
            onClick={nativeNavigation}
          >
            Parent Dashboard
          </Link>
          <Link
            className="inline-flex min-h-11 items-center"
            href={`/parent/children/${created}`}
            prefetch={false}
            onClick={nativeNavigation}
          >
            Edit child profile
          </Link>
        </div>
      ) : (
        <>
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
            {pending
              ? "Saving child profile…"
              : notice
                ? "Retry saving child"
                : "Save child profile"}
          </button>
          {notice && (
            <Link
              className="ms-4 inline-flex min-h-11 items-center"
              href="/parent/children"
              prefetch={false}
              onClick={nativeNavigation}
            >
              Check My Children
            </Link>
          )}
        </>
      )}
    </form>
  );
}
