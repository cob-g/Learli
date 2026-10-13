import { createServer, request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Server } from "node:https";

import {
  hostedBackendPort,
  hostedHttpsPort,
  hostedBrowserHost,
  hostedBrowserOrigin,
} from "./hosted-auth-placement";
export { hostedBrowserOrigin } from "./hosted-auth-placement";
export async function createHostedBrowserProxy(certificates: string) {
  const server = createServer(
    {
      key: readFileSync(path.join(certificates, "trusted.key")),
      cert: readFileSync(path.join(certificates, "trusted.crt")),
    },
    (incoming, response) => {
      if (incoming.headers.host !== hostedBrowserHost) {
        response.statusCode = 403;
        response.end("Synthetic proxy refused.");
        return;
      }
      const headers = { ...incoming.headers };
      for (const name of Object.keys(headers))
        if (
          name.startsWith("x-learli-") ||
          name === "forwarded" ||
          name.startsWith("x-forwarded-") ||
          ["x-real-ip", "cf-connecting-ip"].includes(name)
        )
          delete headers[name];
      headers.host = hostedBrowserHost;
      headers["x-forwarded-proto"] = "https";
      headers["x-forwarded-for"] = "127.0.0.1";
      const upstream = httpRequest(
        {
          host: "127.0.0.1",
          port: hostedBackendPort,
          method: incoming.method,
          path: incoming.url,
          headers,
        },
        (received) => {
          response.writeHead(received.statusCode ?? 503, received.headers);
          received.pipe(response);
        },
      );
      upstream.on("error", () => {
        if (!response.headersSent) {
          response.statusCode = 503;
          response.end("Synthetic application unavailable.");
        } else response.destroy();
      });
      incoming.pipe(upstream);
    },
  );
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(hostedHttpsPort, "127.0.0.1", resolve);
  });
  return { server, close: () => closeProxy(server) };
}
function closeProxy(server: Server) {
  return new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

/** Certificate trust is confined to this exact owned client. */
export function ownedHttpsProbe(
  ca: string,
  url = `${hostedBrowserOrigin}/api/health`,
) {
  if (!url.startsWith(`${hostedBrowserOrigin}/`))
    throw new Error("Owned HTTPS URL required.");
  return new Promise<number>((resolve, reject) => {
    const request = httpsRequest(
      url,
      { ca, rejectUnauthorized: true },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    request.on("error", reject);
    request.end();
  });
}
