import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { composeAccountAuth } from "@/features/hosted-auth/composition";
import {
  handleAccountEmail,
  projectEmailResponse,
} from "@/features/account-email/handler";
import { refusedMailResponse } from "@/features/hosted-auth/mail-attempt";
import { validateLocalWorkflowBinding } from "@/features/local-workflow/runtime";
import { localWorkflowMail } from "@/lib/email/local-verification";
import * as localMail from "@/lib/email/local-mail";
import { syntheticEmail } from "@/lib/local-mode";
import { handleAuthRequest } from "@/lib/auth-handler";
import {
  openWorld,
  closeWorld,
  createAccount,
  jsonRequest,
  password,
  type World,
} from "./support";

let world: World;
beforeAll(() => {
  world = openWorld();
});
beforeEach(() => world.owner.pool.query("UPDATE rate_limit SET count=0"));
afterAll(() => closeWorld(world));

// Test-only transport capability: actual auth/storage stays on isolated learli_test.
// Redirect deliberate capture into that test mailbox, never the development mailbox.
function delivery(recipient: string) {
  const capability = validateLocalWorkflowBinding(
    {
      APP_ENV: "development",
      AUTH_MODE: "local",
      DATABASE_MODE: "local",
      LOCAL_WORKFLOW_MODE: "enabled",
      APP_URL: world.runtime.origin,
      DATABASE_URL:
        "postgresql://learli_app:synthetic@127.0.0.1:55499/learli_dev",
      BETTER_AUTH_SECRET: "synthetic-transport-binding-secret-123456",
    },
    {
      options: {
        host: "127.0.0.1",
        port: 55499,
        database: "learli_dev",
        user: "learli_app",
      },
    },
  )!;
  const capture = vi
    .spyOn(localMail, "captureOperationalMail")
    .mockImplementation(async (cap, mail) => {
      await localMail.captureLocalMail(
        "test",
        localMail.validateOperationalMail(cap, mail),
      );
    });
  const request = vi.fn<typeof fetch>(async () =>
    Response.json({ id: "00000000-0000-4000-8000-000000000000" }),
  );
  const previous = world.runtime;
  world.runtime = {
    ...previous,
    ...composeAccountAuth(previous.db, {
      origin: previous.origin,
      secret: previous.auth.options.secret!,
      hosted: false,
      permitsEmail: syntheticEmail,
      sendMail: localWorkflowMail(
        capability,
        { key: "re_synthetic123456", recipient },
        request,
      ),
    }),
  };
  return {
    request,
    capture,
    restore: () => {
      world.runtime = previous;
      capture.mockRestore();
    },
  };
}
async function proof(
  to: string,
  kind: "email-change-current" | "email-change-new",
  request: ReturnType<typeof delivery>["request"],
) {
  for (const [, init] of request.mock.calls.toReversed()) {
    const mail = JSON.parse(init!.body as string) as {
      to: string[];
      subject: string;
      text: string;
    };
    if (
      mail.to[0] === to &&
      mail.subject.includes(kind === "email-change-current" ? "current" : "new")
    ) {
      const code = mail.text.match(/Your confirmation code: (\d{6})/)?.[1];
      if (code) return code;
    }
  }
  const dir = localMail.localMailbox("test");
  for (const file of (await readdir(dir))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()) {
    const mail = JSON.parse(
      await readFile(path.join(dir, file), "utf8"),
    ) as localMail.LocalMessage;
    if (mail.kind === kind && mail.to === to && "otp" in mail) return mail.otp;
  }
  throw new Error("Synthetic email-change proof missing.");
}

it.each(["current", "new"] as const)(
  "completes both proofs with Resend on the %s side and capture on its synthetic counterpart",
  async (side) => {
    const account = await createAccount(world);
    const other = await handleAuthRequest(
      world.runtime,
      jsonRequest(world, "/api/auth/sign-in/email", {
        body: { email: account.email, password },
      }),
    );
    const otherCookie = other.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; ");
    const next = `delivery-${randomUUID()}@learli.test`;
    const transport = delivery(side === "current" ? account.email : next);
    const change = (body: object) =>
      handleAccountEmail(
        world.runtime,
        jsonRequest(world, "/api/account/email", {
          cookie: account.cookie,
          body,
        }),
      );
    const saved = async () =>
      (
        await world.owner.pool.query(
          'SELECT email,email_verified FROM "user" WHERE id=$1',
          [account.id],
        )
      ).rows[0];
    try {
      expect((await change({ action: "start" })).status).toBe(200);
      const current = await proof(
        account.email,
        "email-change-current",
        transport.request,
      );
      expect(
        (await change({ action: "request", newEmail: next, code: current }))
          .status,
      ).toBe(200);
      expect((await saved()).email).toBe(account.email);
      const code = await proof(next, "email-change-new", transport.request);
      const wrong = code === "000000" ? "111111" : "000000";
      expect(
        (await change({ action: "confirm", newEmail: next, code: wrong }))
          .status,
      ).toBe(400);
      expect((await saved()).email).toBe(account.email);
      const completed = await change({
        action: "confirm",
        newEmail: next,
        code,
      });
      expect(completed.status).toBe(200);
      expect((await saved()).email).toBe(next);
      expect((await saved()).email_verified).toBe(true);
      expect(
        (await change({ action: "confirm", newEmail: next, code })).status,
      ).toBe(400);
      expect(
        await world.runtime.auth.api.getSession({
          headers: new Headers({ cookie: otherCookie }),
        }),
      ).toBeNull();
      const freshCookie = completed.headers
        .getSetCookie()
        .map((v) => v.split(";")[0])
        .join("; ");
      expect(
        (
          await world.runtime.auth.api.getSession({
            headers: new Headers({ cookie: freshCookie }),
          })
        )?.user.email,
      ).toBe(next);
      expect(transport.request).toHaveBeenCalledTimes(1);
      expect(transport.capture).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(
        transport.request.mock.calls[0]![1]!.body as string,
      );
      expect(sent.to).toEqual([side === "current" ? account.email : next]);
      expect(sent.html).not.toContain(
        `href="${world.runtime.origin}/account/email?`,
      );
    } finally {
      transport.restore();
    }
  },
);

it("refuses provider failure without capture fallback or an address mutation", async () => {
  const account = await createAccount(world);
  const transport = delivery(account.email);
  transport.request.mockResolvedValueOnce(
    new Response("private provider error", { status: 403 }),
  );
  try {
    // This isolated runtime is capture-only test mode. Explicitly exercise the
    // same mail-attempt boundary used by the admitted ordinary local service;
    // Better Auth deliberately hides send failures in its accepted OTP response.
    const attempt = await world.runtime.mailAttempt.run(() =>
      handleAccountEmail(
        world.runtime,
        jsonRequest(world, "/api/account/email", {
          cookie: account.cookie,
          body: { action: "start" },
        }),
      ),
    );
    expect(attempt.failed).toBe(true);
    const response = await projectEmailResponse(
      refusedMailResponse(attempt.value),
      "start",
    );
    expect(response.ok).toBe(false);
    expect(await response.text()).not.toContain("private provider error");
    expect(transport.capture).not.toHaveBeenCalled();
    expect(
      (
        await world.owner.pool.query('SELECT email FROM "user" WHERE id=$1', [
          account.id,
        ])
      ).rows[0].email,
    ).toBe(account.email);
  } finally {
    transport.restore();
  }
});
