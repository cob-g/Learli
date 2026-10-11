import { z } from "zod";

export const revokeSessionInput = z.strictObject({
  sessionId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
});

/** Explicit browser-safe projection; never spread a provider session into it. */
export type AccountSession = {
  id: string;
  current: boolean;
  reportedDevice: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

/** User-agent is self-reported; return only fixed labels, never the raw header. */
export function reportedDevice(agent: string | null | undefined) {
  if (!agent) return "Browser details unavailable";
  const value = agent.slice(0, 512);
  const browser = /Edg(?:e|A|iOS)?\//.test(value)
    ? "Edge"
    : /(?:OPR|Opera)\//.test(value)
      ? "Opera"
      : /(?:Firefox|FxiOS)\//.test(value)
        ? "Firefox"
        : /(?:Chrome|CriOS)\//.test(value)
          ? "Chrome"
          : /Version\/.*Safari\//.test(value)
            ? "Safari"
            : undefined;
  const platform = /Android/.test(value)
    ? "Android"
    : /iPhone|iPad|iPod/.test(value)
      ? "iOS"
      : /Windows NT/.test(value)
        ? "Windows"
        : /Macintosh|Mac OS X/.test(value)
          ? "macOS"
          : /Linux/.test(value)
            ? "Linux"
            : undefined;
  if (!browser && !platform) return "Browser details unavailable";
  return [browser ?? "Unknown browser", platform].filter(Boolean).join(" on ");
}

export function sessionTimestamp(instant: string, zone: string) {
  const date = new Date(instant);
  const text = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "longGeneric",
  }).format(date);
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  return `${text} (${offset})`.replace(/[\u202f\u2009]/g, " ");
}
