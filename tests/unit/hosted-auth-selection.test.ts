import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const fixture = vi.hoisted(() => ({
  mode: "disabled",
  fingerprint: "first",
  local: { marker: "local-object" },
  hosted: { marker: "hosted-object", close: vi.fn(async () => {}) },
  localFactory: vi.fn(),
  hostedFactory: vi.fn(),
}));
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({ AUTH_MODE: fixture.mode }),
}));
vi.mock("@/lib/auth-factory", () => ({
  createLocalAuth: fixture.localFactory,
}));
vi.mock("@/features/hosted-auth/factory", () => ({
  createHostedAuth: fixture.hostedFactory,
}));
vi.mock("@/features/hosted-auth/config-file", () => ({
  loadHostedAuthConfig: () => ({
    config: {},
    fingerprint: fixture.fingerprint,
  }),
}));
import { getAuthRuntime, getAccountAuthRuntime } from "@/lib/auth";
const shared = globalThis as typeof globalThis & {
  learliAuth?: unknown;
  learliHostedAuth?: unknown;
  learliAccountMode?: string;
  learliCloseAccountAuth?: () => Promise<void>;
};
afterEach(() => {
  delete shared.learliAuth;
  delete shared.learliHostedAuth;
  delete shared.learliAccountMode;
  delete shared.learliCloseAccountAuth;
  fixture.mode = "disabled";
  fixture.fingerprint = "first";
  vi.clearAllMocks();
});
describe("consumed account selector, factory-stub unit boundary only", () => {
  it("disabled performs no factory work; local selectors share the exact native local object", async () => {
    expect(getAuthRuntime()).toBeNull();
    expect(await getAccountAuthRuntime()).toBeNull();
    expect(fixture.localFactory).not.toHaveBeenCalled();
    expect(fixture.hostedFactory).not.toHaveBeenCalled();
    fixture.mode = "local";
    fixture.localFactory.mockReturnValue(fixture.local);
    const local = getAuthRuntime();
    expect(await getAccountAuthRuntime()).toBe(local);
    expect(fixture.localFactory).toHaveBeenCalledTimes(1);
  });
  it("concurrent selected account calls initialize once and refuse changed mode/config", async () => {
    fixture.mode = "hosted-synthetic";
    fixture.hostedFactory.mockResolvedValue(fixture.hosted);
    const values = await Promise.all(
      Array.from({ length: 8 }, () => getAccountAuthRuntime()),
    );
    expect(values.every((value) => value === values[0])).toBe(true);
    expect(fixture.hostedFactory).toHaveBeenCalledTimes(1);
    expect(getAuthRuntime()).toBeNull();
    fixture.fingerprint = "changed";
    await expect(getAccountAuthRuntime()).rejects.toThrow("configuration");
    fixture.mode = "local";
    await expect(getAccountAuthRuntime()).rejects.toThrow("configuration");
    expect(fixture.localFactory).not.toHaveBeenCalled();
  });
});
