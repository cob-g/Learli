// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
import {
  BrowserTimeZone,
  ProfileZone,
} from "@/features/public-availability/profile-zone";
import {
  parseVisitTimeZone,
  visitTimeZoneKey,
} from "@/features/public-availability/visit-timezone";

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  document.cookie = `${visitTimeZoneKey}=; Max-Age=0; Path=/`;
  window.history.replaceState(null, "", "/tutors/synthetic");
});
describe("visit time-zone preference", () => {
  it("initializes a session cookie without navigating or modifying the account", () => {
    sessionStorage.setItem(visitTimeZoneKey, "Asia/Manila");
    render(<BrowserTimeZone />);
    expect(document.cookie).toContain(`${visitTimeZoneKey}=Asia%2FManila`);
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("keeps explicit visit choices for subsequent server renders", () => {
    render(
      <ProfileZone
        timezone="Pacific/Auckland"
        explicitZone
        needsBrowserZone={false}
      />,
    );
    expect(sessionStorage.getItem(visitTimeZoneKey)).toBe("Pacific/Auckland");
    expect(document.cookie).toContain("Pacific%2FAuckland");
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("does not refetch a profile whose server already knows the zone", () => {
    render(
      <ProfileZone
        timezone="Asia/Manila"
        explicitZone={false}
        needsBrowserZone={false}
      />,
    );
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("retains first-direct-visit correction when the server had no preference", () => {
    sessionStorage.setItem(visitTimeZoneKey, "Pacific/Auckland");
    render(
      <ProfileZone timezone="UTC" explicitZone={false} needsBrowserZone />,
    );
    expect(router.replace).toHaveBeenCalledWith(
      "/tutors/synthetic?displayTimezone=Pacific%2FAuckland",
      { scroll: false },
    );
  });
  it("rejects malformed or non-zone preference values", () => {
    expect(parseVisitTimeZone("%ZZ")).toBeUndefined();
    expect(parseVisitTimeZone("role=admin")).toBeUndefined();
    expect(parseVisitTimeZone("Asia%2FManila")).toBe("Asia/Manila");
  });
});
