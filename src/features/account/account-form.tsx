"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
export function AccountForm({
  account,
}: {
  account: { id: string; name: string; timezone: string };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const notice = useRef<HTMLParagraphElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/account/${encodeURIComponent(account.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.get("name"),
            timezone: data.get("timezone"),
          }),
        },
      );
      setFailed(!response.ok);
      setMessage(
        response.ok
          ? "Account settings saved."
          : "Settings could not be saved. Check your details and sign-in status, then try again.",
      );
      if (response.ok) router.refresh();
    } catch {
      setFailed(true);
      setMessage("The account service could not be reached. Try again.");
    } finally {
      setPending(false);
      requestAnimationFrame(() => notice.current?.focus());
    }
  }
  return (
    <form
      className="mt-8 max-w-prose space-y-6"
      onSubmit={submit}
      aria-busy={pending}
    >
      <div className="space-y-2">
        <label htmlFor="name" className="block text-label">
          Display name
        </label>
        <input
          className="field"
          id="name"
          name="name"
          autoComplete="nickname"
          defaultValue={account.name}
          required
          maxLength={100}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="timezone" className="block text-label">
          Time zone
        </label>
        <select
          className="field"
          id="timezone"
          name="timezone"
          defaultValue={account.timezone}
        >
          {[
            ...new Set([
              "UTC",
              account.timezone,
              ...Intl.supportedValuesOf("timeZone"),
            ]),
          ].map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      {message && (
        <p
          ref={notice}
          tabIndex={-1}
          role={failed ? "alert" : "status"}
          className={failed ? "text-body text-error" : "text-body"}
        >
          {message}
        </p>
      )}
      <button
        className="action action-primary"
        type="submit"
        disabled={pending}
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
