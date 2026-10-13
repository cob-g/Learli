import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { previewContentAllowed } from "@/features/home/preview-content";

afterEach(() => vi.unstubAllEnvs());

describe("preview content gate", () => {
  it("allows preview content in a stated non-production environment", () => {
    for (const environment of ["development", "test", "staging"]) {
      vi.stubEnv("APP_ENV", environment);
      expect(previewContentAllowed(), environment).toBe(true);
    }
  });

  it("never allows it in production", () => {
    vi.stubEnv("APP_ENV", "production");
    expect(previewContentAllowed()).toBe(false);
  });

  it("allows nothing when the environment is not stated or not valid", () => {
    vi.stubEnv("APP_ENV", "");
    expect(previewContentAllowed()).toBe(false);
    vi.stubEnv("APP_ENV", "preview");
    expect(previewContentAllowed()).toBe(false);
  });
});
