import type { MeetingProvider } from "@/lib/validation/meeting-link";

export type PrivateMeetingState =
  | { state: "awaiting_confirmation" }
  | { state: "expired" }
  | { state: "missing"; canEdit: boolean; revision: 0 }
  | {
      state: "present";
      canEdit: boolean;
      revision: number;
      provider: MeetingProvider;
      url: string;
    };

export type MeetingSectionState =
  PrivateMeetingState | { state: "unavailable" } | { state: "error" };
