import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Reuse the owned local app/project; no unrelated hosted mirror servers.
const server = Array.isArray(base.webServer)
  ? base.webServer[0]
  : base.webServer;
const port = new URL(process.env.APP_URL ?? "http://127.0.0.1:3100").port;
export default defineConfig({
  ...base,
  workers: 1,
  projects: base.projects
    ?.filter((project) => project.name === "booking-meeting-links")
    .map((project) => ({ ...project, dependencies: [] })),
  webServer: server
    ? { ...server, command: `npm run dev -- --port ${port}`, timeout: 120000 }
    : undefined,
});
