// Test-owned SDK HTTP boundary. No application module imports this script.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createDatabase } from "../../src/lib/db/connection";
import { assertOwnedReadinessDatabase } from "./readiness-placement";
import { bindTransactionalDelivery } from "../../src/features/transactional-delivery/context";
import { drainTransactionalDeliveries } from "../../src/features/transactional-delivery/drain";

async function main() {
  assertOwnedReadinessDatabase(process.cwd());
  const [event, mode] = process.argv.slice(2);
  const eventId = z.uuid().parse(event);
  if (!["accepted", "429", "503", "timeout"].includes(mode))
    throw new Error("Synthetic SDK mode refused.");
  const database = createDatabase(process.env.DATABASE_URL ?? "", true);
  try {
    const recipients = await database.pool.query<{ email: string }>(
      'SELECT u.email FROM booking_workflow_notice_intents i JOIN "user" u ON u.id=i.recipient_user_id WHERE i.event_id=$1',
      [eventId],
    );
    const allowedRecipients = recipients.rows.map((r) => r.email);
    const directory = path.resolve(".local/transactional-delivery/browser-sdk");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const appOrigin = "https://learli.example";
    const context = bindTransactionalDelivery(
      database.db,
      {
        enabled: true,
        environment: "test",
        appOrigin,
        identitySecret: "W4-browser-synthetic-message-binding-only",
        apiKey: "re_synthetic_browser_sdk_key_only",
        sender: "sender@example.test",
        verifiedSender: {
          sender: "sender@example.test",
          environment: "test",
          appOrigin,
        },
        allowedRecipients,
        timeoutMs: 500,
      },
      {
        fetch: async (input, options) => {
          if (
            String(input) !== "https://api.resend.com/emails" ||
            options?.method !== "POST" ||
            typeof options.body !== "string"
          )
            throw new Error("External HTTP is forbidden.");
          const body = z
            .strictObject({
              from: z.literal("sender@example.test"),
              to: z.array(z.string().email()).length(1),
              subject: z.string(),
              text: z.string(),
              html: z.string(),
            })
            .parse(JSON.parse(options.body));
          const key = new Headers(options.headers).get("Idempotency-Key");
          if (
            !key?.startsWith("learli/") ||
            !allowedRecipients.includes(body.to[0])
          )
            throw new Error("Synthetic SDK recipient refused.");
          writeFileSync(
            path.join(directory, `${Date.now()}-${randomUUID()}.json`),
            JSON.stringify({ eventId, body, key, mode }),
            { mode: 0o600, flag: "wx" },
          );
          if (mode === "timeout")
            throw new Error("Synthetic acceptance ambiguity.");
          return Response.json(
            mode === "accepted"
              ? { id: randomUUID() }
              : { name: "application_error" },
            { status: mode === "accepted" ? 200 : Number(mode) },
          );
        },
      },
    );
    if (!context) throw new Error("Synthetic delivery binding refused.");
    process.stdout.write(
      `${JSON.stringify(await drainTransactionalDeliveries(context, { eventId }))}\n`,
    );
  } finally {
    await database.pool.end();
  }
}
void main().catch(() => {
  process.stderr.write(
    "Synthetic delivery fixture failed; private evidence retained.\n",
  );
  process.exitCode = 1;
});
