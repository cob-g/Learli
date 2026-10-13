import next from "next";
import { createServer } from "node:http";
import { loadHostedAuthConfig } from "../src/features/hosted-auth/config-file";
import {
  admitHostedIngress,
  hostedResponseHeaders,
} from "../src/features/hosted-auth/ingress-node";

async function start() {
  const { config } = loadHostedAuthConfig(process.env);
  const port = Number(process.env.PORT);
  if (!/^[1-9][0-9]{0,4}$/.test(process.env.PORT ?? "") || port > 65535)
    throw new Error();
  const hostname = process.env.HOSTNAME ?? "127.0.0.1";
  if (!["127.0.0.1", "0.0.0.0"].includes(hostname)) throw new Error();
  const application = next({ dev: false, hostname, port });
  try {
    await application.prepare();
  } catch {
    await application.close().catch(() => undefined);
    throw new Error("Hosted preparation failed.");
  }
  const handler = application.getRequestHandler();
  const server = createServer((request, response) => {
    hostedResponseHeaders(response);
    if (request.method === "GET" && request.url === "/api/health") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }
    if (!admitHostedIngress(config, request)) {
      response.statusCode = 403;
      response.end("Account access is unavailable.");
      return;
    }
    void handler(request, response).catch(() => {
      if (!response.headersSent) {
        response.statusCode = 503;
        response.end("Account service is unavailable.");
      } else response.destroy();
    });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, hostname, resolve);
    });
  } catch {
    await application.close().catch(() => undefined);
    throw new Error("Hosted listener failed.");
  }
  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    const timer = setTimeout(() => {
      process.stderr.write("Hosted shutdown failed.\n");
      process.exit(1);
    }, 10000);
    timer.unref();
    try {
      let failed = false;
      await new Promise<void>((resolve) =>
        server.close((error) => {
          if (error) failed = true;
          resolve();
        }),
      );
      const shared = globalThis as typeof globalThis & {
        learliCloseAccountAuth?: () => Promise<void>;
      };
      const closed = await Promise.allSettled([
        shared.learliCloseAccountAuth?.(),
        application.close(),
      ]);
      if (failed || closed.some((result) => result.status === "rejected"))
        throw new Error("Hosted drain failed.");
      clearTimeout(timer);
      process.exitCode = 0;
    } catch {
      process.stderr.write("Hosted shutdown failed.\n");
      process.exitCode = 1;
    }
  }
  process.on("SIGTERM", () => {
    void shutdown();
  });
  process.on("SIGINT", () => {
    void shutdown();
  });
}
void start().catch(() => {
  process.stderr.write("Hosted startup refused.\n");
  process.exitCode = 1;
});
