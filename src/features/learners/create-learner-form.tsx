"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import Link from "next/link";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { learnerLevelOptions } from "@/features/subjects/catalog";
import type { TimeZoneOption } from "@/lib/time/zones";
import {
  clearRequestId,
  isUncertainRequestStatus,
  rememberRequestId,
  requestFingerprint,
  reusableRequestId,
} from "./pending-request";

const pendingScope = "create-learner";

export function CreateLearnerForm({
  requestId,
  modes,
  timezone,
  zones,
  returnToBooking,
}: {
  requestId: string;
  modes: ("guardian" | "self")[];
  timezone: string;
  zones: TimeZoneOption[];
  returnToBooking?: string;
}) {
  const ready = useHydrated();
  const [management, setManagement] = useState(modes[0]);
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

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !ready) return;
    const data = new FormData(event.currentTarget);
    const payload = {
      management,
      displayName: data.get("displayName"),
      level: data.get("level"),
      timezone: data.get("timezone"),
    };
    const fingerprint = requestFingerprint(payload);
    const id = reusableRequestId(pendingScope, fingerprint, requestId);
    busy.current = true;
    setPending(true);
    setNotice("");
    setFields({});
    rememberRequestId(pendingScope, fingerprint, id);
    try {
      const response = await fetch("/api/learners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, ...payload }),
      });
      const result = await response.json();
      if (
        response.ok &&
        typeof result.id === "string" &&
        /^[0-9a-f-]{36}$/i.test(result.id)
      ) {
        clearRequestId(pendingScope);
        setCreated(result.id);
        setNotice("Local learner created");
      } else {
        const uncertain =
          isUncertainRequestStatus(response.status) || response.ok;
        if (!uncertain) clearRequestId(pendingScope);
        const errors: Record<string, string> = {};
        for (const key of ["displayName", "level", "timezone"])
          if (typeof result.fields?.[key] === "string")
            errors[key] = result.fields[key];
        setFields(errors);
        setNotice(
          uncertain
            ? "We could not confirm creation. Keep these fields and retry this request, or check your learners first."
            : response.status === 409
              ? "This request could not create another profile. Check your learners before starting a new request."
              : "Learner could not be created. Check the fields and your account access, then retry this request.",
        );
        busy.current = false;
      }
    } catch {
      setNotice(
        "We could not confirm creation. Keep these fields and retry this request, or check your learners first.",
      );
      busy.current = false;
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      ref={formRef}
      className="mt-8 max-w-xl space-y-4"
      onSubmit={create}
      action="/api/learners"
      method="post"
      aria-busy={pending}
      noValidate
    >
      <noscript>
        <p className="text-body">
          JavaScript is required to create a local demonstration profile. You
          can still view your learners.
        </p>
      </noscript>
      {!created && (
        <>
          <p className="text-small text-muted-foreground">
            All fields are required. No real learner details.
          </p>
          {modes.length > 1 && (
            <div className="space-y-2">
              <label className="block text-label" htmlFor="management">
                Local profile type
              </label>
              <select
                id="management"
                className="field"
                value={management}
                disabled={!ready || pending}
                onChange={(event) =>
                  setManagement(
                    event.target.value === "self" ? "self" : "guardian",
                  )
                }
              >
                <option value="guardian">Parent-managed demonstration</option>
                <option value="self">Your College Support demonstration</option>
              </select>
            </div>
          )}
          {management === "self" && (
            <p className="text-body">
              This creates your own College Support profile without a guardian.
            </p>
          )}
          <div className="space-y-2">
            <label className="block text-label" htmlFor="displayName">
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              className="field"
              required
              maxLength={80}
              autoComplete="off"
              disabled={!ready || pending}
              aria-invalid={!!fields.displayName}
              aria-describedby={
                fields.displayName ? "displayName-error" : undefined
              }
            />
            {fields.displayName && (
              <p id="displayName-error" className="text-small text-error">
                {fields.displayName}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="block text-label" htmlFor="level">
              Level
            </label>
            <select
              key={management}
              id="level"
              name="level"
              className="field"
              defaultValue={management === "self" ? "college_support" : ""}
              disabled={!ready || pending}
              aria-invalid={!!fields.level}
              aria-describedby={fields.level ? "level-error" : undefined}
            >
              {management !== "self" && (
                <option value="">Choose a level</option>
              )}
              {learnerLevelOptions
                .filter(
                  ([value]) =>
                    management !== "self" || value === "college_support",
                )
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
            {fields.level && (
              <p id="level-error" className="text-small text-error">
                {fields.level}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="block text-label" htmlFor="timezone">
              Time zone
            </label>
            <select
              id="timezone"
              name="timezone"
              className="field"
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
            {fields.timezone && (
              <p id="timezone-error" className="text-small text-error">
                {fields.timezone}
              </p>
            )}
          </div>
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
          {returnToBooking && (
            <Link
              className="action action-primary"
              href={returnToBooking}
              prefetch={false}
              onClick={(event) => {
                event.preventDefault();
                window.location.assign(event.currentTarget.href);
              }}
            >
              Return to selected time
            </Link>
          )}
          <Link
            className={
              returnToBooking
                ? "action action-outline"
                : "action action-primary"
            }
            href={`/learners/${created}`}
            prefetch={false}
            onClick={(event) => {
              event.preventDefault();
              window.location.assign(event.currentTarget.href);
            }}
          >
            Edit local profile
          </Link>
          <Link
            className="action action-outline"
            href="/learners"
            prefetch={false}
            onClick={(event) => {
              event.preventDefault();
              window.location.assign(event.currentTarget.href);
            }}
          >
            Your learners
          </Link>
        </div>
      ) : (
        <button
          type="submit"
          className="action action-primary"
          disabled={!ready}
          aria-disabled={pending}
          onClick={(event) => {
            if (busy.current) event.preventDefault();
          }}
        >
          {pending && (
            <LoaderCircle
              className="size-4 motion-safe:animate-spin"
              aria-hidden="true"
            />
          )}
          {pending
            ? "Creating local learner…"
            : notice
              ? "Retry this request"
              : "Create local learner"}
        </button>
      )}
    </form>
  );
}
