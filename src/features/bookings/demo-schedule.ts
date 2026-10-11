import {
  generateSlots,
  type UtcInterval,
  type WeeklyWindow,
} from "@/lib/time/availability";
import { demoBookingPolicy } from "./demo-policy";

/** Pure policy inputs shared by advisory public reads and authoritative booking. */
export function demoCandidateRange(
  now: Date,
  requested?: { from?: string; to?: string },
) {
  const earliest = now.getTime() + demoBookingPolicy.noticeMinutes * 60_000;
  const latest = now.getTime() + demoBookingPolicy.horizonDays * 86_400_000;
  const clamp = (value: number) => Math.max(earliest, Math.min(latest, value));
  const from = new Date(
    clamp(requested?.from ? new Date(requested.from).getTime() : earliest),
  );
  const to = new Date(
    clamp(requested?.to ? new Date(requested.to).getTime() : latest),
  );
  return {
    from,
    to,
    busyTo: new Date(to.getTime() + demoBookingPolicy.durationMinutes * 60_000),
  };
}

export function demoCandidateIntervals(input: {
  timezone: string;
  windows: readonly WeeklyWindow[];
  busy: readonly UtcInterval[];
  from: Date;
  to: Date;
}) {
  return generateSlots({
    timeZone: input.timezone,
    windows: input.windows,
    busy: input.busy,
    from: input.from,
    to: input.to,
    slotMinutes: demoBookingPolicy.durationMinutes,
    stepMinutes: demoBookingPolicy.stepMinutes,
  });
}
