import { setTimeout as delay } from "node:timers/promises";
import { googleMeetWorkerConfig } from "../src/features/google-meet/config";
import { googleMeetProvider } from "../src/features/google-meet/provider";
import { drainGoogleMeet } from "../src/features/google-meet/worker";
import { createGoogleMeetWorkerDatabase } from "../src/features/google-meet/worker-database";

let stopping = false;
const stop = () => {
  stopping = true;
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
async function main() {
  const config = googleMeetWorkerConfig(process.env);
  const pool = await createGoogleMeetWorkerDatabase(
    process.env.GOOGLE_MEET_WORKER_DATABASE_URL,
  );
  try {
    const provider = googleMeetProvider(config);
    console.log("Google Meet worker ready. Private values omitted.");
    while (!stopping) {
      const counts = await drainGoogleMeet(
        pool,
        config,
        provider,
        10,
        (diagnostic) => {
          console.warn("Google Meet create diagnostic:", diagnostic);
        },
      );
      if (counts.claimed) console.log("Google Meet batch:", counts);
      // One supervised process; no timers at module import or in Next requests.
      for (let i = 0; i < 15 && !stopping; i++) await delay(1000);
    }
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Google Meet worker stopped after a configuration or database failure. Private details omitted.",
  );
  process.exitCode = 1;
});
