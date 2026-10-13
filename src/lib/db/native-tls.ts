import { TLSSocket, checkServerIdentity } from "node:tls";
import { Client, type ClientBase, type PoolConfig } from "pg";
import { StagingDatabaseError } from "./staging-config";

/** Neon terminates client TLS before the PostgreSQL backend; SQL ssl is not
 * client transport evidence. Inspect the actual pinned driver's native socket. */
export function verifyNativeTls(client: ClientBase, options: PoolConfig): void {
  try {
    if (!(client instanceof Client)) throw new Error();
    // pg's native connection is internal to the pinned8.23.1 Client, not a
    // caller assertion or application-facing transport interface.
    const native = client as Client & { connection: { stream: unknown } };
    const socket = native.connection.stream;
    const ssl = options.ssl;
    const hostname =
      typeof ssl === "object" &&
      "servername" in ssl &&
      typeof ssl.servername === "string"
        ? ssl.servername
        : options.host;
    if (
      typeof ssl !== "object" ||
      ssl.rejectUnauthorized !== true ||
      !hostname ||
      !(socket instanceof TLSSocket) ||
      socket.destroyed ||
      socket.encrypted !== true ||
      socket.authorized !== true ||
      checkServerIdentity(hostname, socket.getPeerCertificate())
    )
      throw new Error();
  } catch {
    throw new StagingDatabaseError("identity_mismatch");
  }
}
