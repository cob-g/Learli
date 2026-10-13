import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const database = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn() }));
vi.mock("@/lib/db/hosted-runtime", () => ({
  createHostedRuntimeDatabase: database.open,
}));
vi.mock("@/features/hosted-auth/composition", () => ({
  composeAccountAuth: () => {
    throw new Error("synthetic-private-failure");
  },
}));
import { createHostedAuth } from "@/features/hosted-auth/factory";
import { parseHostedAuthConfig } from "@/features/hosted-auth/config";
import {
  hostedTestPacket,
  hostedTestSource,
} from "../support/hosted-auth-packet";

describe("shipped hosted factory admission before I/O", () => {
  it("denies forged configs, disabled ingress and loopback/production/test packets without connections", async () => {
    const config = parseHostedAuthConfig(hostedTestSource(), {
      ...hostedTestPacket(),
      ingress: { mode: "disabled" },
    });
    await expect(createHostedAuth(config)).rejects.toThrow("unavailable");
    await expect(createHostedAuth({ ...config })).rejects.toThrow(
      "configuration",
    );
    expect(() =>
      parseHostedAuthConfig(
        { ...hostedTestSource(), APP_ENV: "production" },
        hostedTestPacket(),
      ),
    ).toThrow();
    expect(() =>
      parseHostedAuthConfig(
        {
          ...hostedTestSource(),
          APP_URL: "https://127.0.0.1:3293",
          BETTER_AUTH_URL: "https://127.0.0.1:3293",
        },
        hostedTestPacket(),
      ),
    ).toThrow();
    const packet = hostedTestPacket();
    expect(() =>
      parseHostedAuthConfig(hostedTestSource(), {
        ...packet,
        mail: {
          ...packet.mail,
          transport: { ...packet.mail.transport, environment: "test" },
        },
      }),
    ).toThrow();
    expect(database.open).not.toHaveBeenCalled();
  });
  it("cleans the actual acquired database when subsequent provider composition fails, with a safe error", async () => {
    database.close.mockResolvedValue(undefined);
    // A deliberately invalid Database tests only failure cleanup, not successful provider acceptance.
    database.open.mockResolvedValue({
      db: null,
      pool: {},
      close: database.close,
    });
    const config = parseHostedAuthConfig(
      hostedTestSource(),
      hostedTestPacket(),
    );
    await expect(createHostedAuth(config)).rejects.toThrow("Details omitted");
    expect(database.close).toHaveBeenCalledTimes(1);
  });
});
