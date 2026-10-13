// Test-only placement. Application/provider admission rules do not consume this.
import { stagingTlsTestPort } from "./staging-tls";

export const hostedBackendPort = stagingTlsTestPort(
  process.env.LEARLI_HOSTED_BACKEND_PORT ?? "3093",
);
export const hostedHttpsPort = stagingTlsTestPort(
  process.env.LEARLI_HOSTED_HTTPS_PORT ?? "3293",
);
export const hostedTlsPort = stagingTlsTestPort(
  process.env.LEARLI_STAGING_TEST_PORT ?? "56003",
);
if (new Set([hostedBackendPort, hostedHttpsPort, hostedTlsPort]).size !== 3)
  throw new Error("Owned hosted fixture ports must be distinct.");
export const hostedBrowserHost = `127.0.0.1:${hostedHttpsPort}`;
export const hostedBrowserOrigin = `https://${hostedBrowserHost}`;
