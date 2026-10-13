// Test-child-only containment and proof. Never imported by application/runtime.
import { Socket } from "node:net";
import { writeFileSync } from "node:fs";
import path from "node:path";
const counts = { tcp: 0, fetch: 0, ipc: 0 };
const originalConnect = Socket.prototype.connect;
Socket.prototype.connect = function (...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  const ipcPath =
    typeof options === "object" && options !== null ? options.path : undefined;
  if (
    typeof ipcPath === "string" &&
    ipcPath.includes("/tsx-") &&
    ipcPath.endsWith(".pipe")
  ) {
    counts.ipc++;
    return originalConnect.apply(this, args);
  }
  counts.tcp++;
  throw new Error("Synthetic operator test forbids network.");
};
globalThis.fetch = async () => {
  counts.fetch++;
  throw new Error("Synthetic operator test forbids HTTP.");
};
process.on("exit", () => {
  if (
    path.resolve(process.argv[1] ?? "") !==
    path.resolve("scripts/transactional-delivery.ts")
  )
    return;
  const proof = process.env.LEARLI_W4_NETWORK_PROOF;
  if (
    !proof ||
    !path
      .resolve(proof)
      .startsWith(path.resolve(".local/transactional-delivery/operator-") + "-")
  )
    return;
  writeFileSync(proof, JSON.stringify(counts), { mode: 0o600 });
});
