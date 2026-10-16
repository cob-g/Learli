import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicTutor } from "@/features/tutors/eligibility";

const state = vi.hoisted(() => ({
  session: vi.fn(),
  cookie: vi.fn(),
  select: vi.fn(),
  candidates: vi.fn(),
  cookieRead: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => {
    state.cookieRead();
    return { get: state.cookie };
  },
}));
vi.mock("@/lib/auth", () => ({
  getDomainAuthRuntime: async () => ({
    auth: { api: { getSession: state.session } },
    db: { select: state.select },
  }),
}));
vi.mock("@/features/public-availability/service", () => ({
  readPublicCandidates: state.candidates,
}));
import { loadProfilePreview } from "@/features/public-availability/profile";

const tutor: PublicTutor = {
  slug: "synthetic",
  displayName: "Synthetic tutor",
  headline: "Math",
  bio: "Synthetic",
  teachingBackground: "Synthetic",
  teachingLanguages: [],
  offerings: [
    {
      subjectSlug: "math",
      subjectName: "Math",
      levels: ["elementary"],
      specialty: null,
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  state.session.mockResolvedValue(null);
  state.cookie.mockReturnValue(undefined);
  state.select.mockReturnValue({
    from: () => ({
      where: () => ({ limit: async () => [{ timezone: "America/New_York" }] }),
    }),
  });
  state.candidates.mockResolvedValue({
    tutors: [{ state: "empty", times: [] }],
  });
});
describe("profile time-zone precedence without redundant reads", () => {
  it("uses explicit URL zone without session, cookie or teaching-zone queries", async () => {
    const result = await loadProfilePreview(tutor, {
      displayTimezone: "Asia/Manila",
      subject: "math",
      level: "elementary",
    });
    expect(result.timezone).toBe("Asia/Manila");
    expect(result.needsBrowserZone).toBe(false);
    expect(state.session).not.toHaveBeenCalled();
    expect(state.cookieRead).not.toHaveBeenCalled();
    expect(state.select).not.toHaveBeenCalled();
    expect(state.candidates).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ displayTimezone: "Asia/Manila" }),
    );
  });
  it("prefers current account zone over the visit cookie", async () => {
    state.session.mockResolvedValue({ user: { timezone: "US/Pacific" } });
    state.cookie.mockReturnValue({ value: "Asia%2FManila" });
    const result = await loadProfilePreview(tutor, {});
    expect(result.timezone).toBe("US/Pacific");
    expect(result.needsBrowserZone).toBe(false);
    expect(state.cookieRead).not.toHaveBeenCalled();
    expect(state.select).not.toHaveBeenCalled();
  });
  it("uses a valid visit preference without another page request or tutor-zone read", async () => {
    state.cookie.mockReturnValue({ value: "Pacific%2FAuckland" });
    const result = await loadProfilePreview(tutor, {});
    expect(result.timezone).toBe("Pacific/Auckland");
    expect(result.needsBrowserZone).toBe(false);
    expect(state.select).not.toHaveBeenCalled();
    expect(state.candidates).not.toHaveBeenCalled();
  });
  it.each([
    undefined,
    "%ZZ",
    "Mars/Planet",
    "Asia/Manila; role=admin",
    "x".repeat(301),
  ])("keeps the tutor fallback for absent/invalid cookie %s", async (value) => {
    state.cookie.mockReturnValue(value === undefined ? undefined : { value });
    const result = await loadProfilePreview(tutor, {});
    expect(result.timezone).toBe("America/New_York");
    expect(result.needsBrowserZone).toBe(true);
    expect(state.select).toHaveBeenCalledOnce();
  });
});
