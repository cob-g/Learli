// Test-owned TLS termination mirrors Neon's client/backend transport separation.
import { createConnection, createServer, type Socket } from "node:net";
import { createSecureContext, TLSSocket } from "node:tls";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { StagingTlsHarness } from "./staging-tls";

export async function createPostgresTlsProxy(harness: StagingTlsHarness) {
  if (process.env.APP_ENV !== "test")
    throw new Error("Owned TLS proxy requires local tests.");
  const sockets = new Set<Socket>();
  const context = createSecureContext({
    key: readFileSync(path.join(harness.directory, "trusted.key")),
    cert: readFileSync(path.join(harness.directory, "trusted.crt")),
  });
  const track = (socket: Socket) => {
    sockets.add(socket);
    socket.on("error", () => socket.destroy());
    socket.on("close", () => sockets.delete(socket));
    return socket;
  };
  const server = createServer((socket) => {
    track(socket);
    socket.once("data", (request: Buffer) => {
      if (
        request.length !== 8 ||
        request.readUInt32BE(0) !== 8 ||
        request.readUInt32BE(4) !== 80877103
      ) {
        socket.destroy();
        return;
      }
      socket.write("S");
      const secure = track(
        new TLSSocket(socket, { isServer: true, secureContext: context }),
      );
      const backend = track(
        createConnection({ host: "127.0.0.1", port: harness.port }),
      );
      secure.pipe(backend);
      backend.pipe(secure);
      secure.on("close", () => backend.destroy());
      backend.on("close", () => secure.destroy());
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Owned TLS proxy did not bind.");
  return {
    port: address.port,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
