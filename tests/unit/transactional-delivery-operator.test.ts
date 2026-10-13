import { describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  hostedTestPacket,
  hostedTestOrigin,
} from "../support/hosted-auth-packet";

describe("registered operator command actual disabled execution", () => {
  it("loads server-only with react-server conditions and returns disabled without database/provider network", () => {
    const directory = path.resolve(".local/transactional-delivery");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const id = randomUUID(),
      packet = path.join(directory, `operator-${id}.json`),
      proof = path.join(directory, `operator--${id}-network.json`);
    writeFileSync(
      packet,
      JSON.stringify({
        ...hostedTestPacket(),
        mail: { mode: "disabled" },
        ingress: { mode: "disabled" },
      }),
      { mode: 0o600 },
    );
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      APP_ENV: "staging",
      AUTH_MODE: "hosted-synthetic",
      APP_URL: hostedTestOrigin,
      BETTER_AUTH_URL: hostedTestOrigin,
      BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
      HOSTED_INGRESS_SECRET: randomBytes(48).toString("hex"),
      HOSTED_AUTH_CONFIG_FILE: packet,
      LEARLI_W4_NETWORK_PROOF: proof,
      NODE_OPTIONS: `--import ${path.resolve("tests/support/transactional-delivery-network-block.mjs")}`,
    };
    delete env.DATABASE_URL;
    delete env.DATABASE_URL_DIRECT;
    delete env.BETTER_AUTH_SECRETS;
    const output = execFileSync("npm", ["run", "delivery:drain", "--", "25"], {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
      timeout: 20000,
    });
    const last = output.trim().split("\n").at(-1);
    if (!last) throw new Error("Operator produced no status.");
    expect(JSON.parse(last)).toEqual({
      status: "disabled",
    });
    const network = JSON.parse(readFileSync(proof, "utf8"));
    expect(network.tcp).toBe(0);
    expect(network.fetch).toBe(0);
    expect(network.ipc).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(output)).not.toContain(env.BETTER_AUTH_SECRET);
  });
});
