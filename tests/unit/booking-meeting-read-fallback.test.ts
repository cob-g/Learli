import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthRuntime } from "@/lib/auth-factory";
import type { MeetingSnapshot } from "@/features/booking-meeting-links/query";
import { AccessError } from "@/lib/permissions/access";
import { googleMeetConfig } from "@/features/google-meet/config";

const deps = vi.hoisted(() => ({ query: vi.fn(), actor: vi.fn() }));
vi.mock("@/lib/permissions/coordination-session", () => ({
  resolveCoordinationSession: deps.actor,
}));
vi.mock("@/features/private-workflow/runtime", () => ({
  assertPrivateWorkflowUnchanged: () => {},
}));
vi.mock("@/features/booking-meeting-links/query", () => ({
  queryPrivateMeeting: deps.query,
}));
import { readPrivateMeetingLink } from "@/features/booking-meeting-links/service";

const bookingId = "d350eac6-c9f2-4834-b535-608834f0f678";
const snapshot: MeetingSnapshot = {
  source: "local_operation",
  live: true,
  awaitingConfirmation: false,
  canEdit: true,
  now: "2026-10-27T10:00:00Z",
  url: null,
  provider: null,
  revision: null,
};
const execute = vi.fn();
// Auth/query seams provide an already-authorized snapshot; real ownership is
// separately exercised by the PostgreSQL private-link integration suite.
const runtime = { db: { execute } } as unknown as AuthRuntime;
const read = () => readPrivateMeetingLink(runtime, new Headers(), bookingId);

function configureGoogle() {
  for (const [key, value] of Object.entries({
    GOOGLE_MEET_ENABLED: "true",
    APP_ENV: "development",
    AUTH_MODE: "local",
    DATABASE_MODE: "local",
    LOCAL_WORKFLOW_MODE: "enabled",
    APP_URL: "http://127.0.0.1:3000",
    DATABASE_URL:
      "postgresql://learli_app:synthetic@127.0.0.1:55432/learli_dev",
    BETTER_AUTH_SECRET: "synthetic-secret-".repeat(4),
    GOOGLE_MEET_CLIENT_ID: "synthetic.apps.googleusercontent.com",
    GOOGLE_MEET_CLIENT_SECRET: "synthetic-only-secret",
    GOOGLE_MEET_REDIRECT_URI:
      "http://127.0.0.1:3000/api/tutor/meeting-providers/google/callback",
    GOOGLE_MEET_KEY_ID: "test",
    GOOGLE_MEET_KEYS: JSON.stringify({ test: "a".repeat(64) }),
  }))
    vi.stubEnv(key, value);
}

beforeEach(() => {
  vi.resetAllMocks();
  configureGoogle();
  deps.actor.mockResolvedValue({
    userId: "synthetic-tutor",
    sessionId: "synthetic-session",
    localWorkflow: true,
  });
  deps.query.mockResolvedValue(snapshot);
  execute.mockResolvedValue({ rows: [{ status: null }] });
});
afterEach(() => vi.unstubAllEnvs());

describe("manual meeting access with optional Google configuration", () => {
  it.each([
    ["missing client", "GOOGLE_MEET_CLIENT_ID", ""],
    ["malformed keys", "GOOGLE_MEET_KEYS", "invalid-json"],
  ])("preserves the first manual form with %s", async (_, key, value) => {
    vi.stubEnv(key, value);
    expect(() => googleMeetConfig()).toThrow("Values omitted");
    await expect(read()).resolves.toEqual({
      state: "missing",
      canEdit: true,
      revision: 0,
      provisioning: "action_required",
    });
    expect(deps.query).toHaveBeenCalledTimes(2);
  });

  it("does not give participants edit permission during configuration failure", async () => {
    vi.stubEnv("GOOGLE_MEET_KEYS", "invalid-json");
    deps.query.mockResolvedValue({ ...snapshot, canEdit: false });
    await expect(read()).resolves.toMatchObject({
      state: "missing",
      canEdit: false,
      provisioning: "action_required",
    });
  });

  it("returns a manual link saved between the two authorized reads", async () => {
    vi.stubEnv("GOOGLE_MEET_KEYS", "invalid-json");
    deps.query.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({
      ...snapshot,
      url: "https://meet.google.com/aaa-bbbb-ccc",
      provider: "google_meet",
      revision: 1,
    });
    await expect(read()).resolves.toMatchObject({
      state: "present",
      canEdit: true,
      revision: 1,
    });
  });

  it("keeps existing saved links independent of invalid configuration", async () => {
    vi.stubEnv("GOOGLE_MEET_KEYS", "invalid-json");
    deps.query.mockResolvedValue({
      ...snapshot,
      url: "https://meet.google.com/aaa-bbbb-ccc",
      provider: "google_meet",
      revision: 2,
    });
    await expect(read()).resolves.toMatchObject({
      state: "present",
      revision: 2,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("still denies revoked ownership on the second read", async () => {
    vi.stubEnv("GOOGLE_MEET_KEYS", "invalid-json");
    deps.query.mockResolvedValueOnce(snapshot).mockResolvedValueOnce(undefined);
    await expect(read()).rejects.toBeInstanceOf(AccessError);
  });

  it("still propagates database failure instead of exposing an edit form", async () => {
    vi.stubEnv("GOOGLE_MEET_KEYS", "invalid-json");
    execute.mockRejectedValue(new Error("synthetic database failure"));
    await expect(read()).rejects.toThrow("synthetic database failure");
  });

  it("denies unrelated accounts before checking provisioning", async () => {
    deps.query.mockResolvedValue(undefined);
    await expect(read()).rejects.toBeInstanceOf(AccessError);
    expect(execute).not.toHaveBeenCalled();
  });

  it("preserves the preparing state for valid configuration", async () => {
    execute.mockResolvedValue({ rows: [{ status: "preparing" }] });
    await expect(read()).resolves.toMatchObject({ provisioning: "preparing" });
  });

  it("keeps disabled operation manual without inventing a provider error", async () => {
    vi.stubEnv("GOOGLE_MEET_ENABLED", "false");
    await expect(read()).resolves.toEqual({
      state: "missing",
      canEdit: true,
      revision: 0,
    });
  });
});
