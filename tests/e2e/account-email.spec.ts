import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDatabase } from "../../src/lib/db/connection";
import {
  localMailbox,
  type LocalMessage,
} from "../../src/lib/email/local-mail";
test.use({ trace: "off", screenshot: "off" });
const baseURL = process.env.APP_URL!;
const owner = createDatabase(process.env.DATABASE_URL_DIRECT ?? "", true);
const password = "Synthetic-email-browser-passphrase-123";
test.beforeEach(() => owner.pool.query("UPDATE rate_limit SET count=0"));
test.afterAll(() => owner.pool.end());
async function signIn(context: BrowserContext, email: string) {
  return context.request.post("/api/auth/sign-in/email", {
    headers: { origin: baseURL },
    data: { email, password },
  });
}
async function actor(browser: Browser, javaScriptEnabled = true, width = 1440) {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled,
    viewport: { width, height: 900 },
  });
  const email = `email-${randomUUID()}@learli.test`;
  const response = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { email, password, name: "Synthetic email account" },
  });
  expect(response.status()).toBe(200);
  const id = (await response.json()).user.id as string;
  await owner.pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [
    id,
  ]);
  expect((await signIn(context, email)).status()).toBe(200);
  return { context, page: await context.newPage(), email, id };
}
async function capture(
  to: string,
  kind: "email-change-current" | "email-change-new",
) {
  const directory = localMailbox("test");
  for (const file of (await readdir(directory))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse()) {
    const message = JSON.parse(
      await readFile(path.join(directory, file), "utf8"),
    ) as LocalMessage;
    if (message.to === to && message.kind === kind && "otp" in message)
      return {
        ...message,
        html: path.join(directory, file.replace(/\.json$/, ".html")),
      };
  }
  throw Error("Expected owned local capture.");
}
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        contrast: n.any
          .filter((c) => c.id === "color-contrast")
          .map((c) => ({
            foreground: c.data?.fgColor,
            background: c.data?.bgColor,
            ratio: c.data?.contrastRatio,
          })),
      })),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function start(page: Page) {
  await page.goto("/account/email");
  await page.getByRole("button", { name: "Send current-address code" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Current-address code")).toBeVisible();
}
async function pending(account: Awaited<ReturnType<typeof actor>>) {
  await start(account.page);
  const current = await capture(account.email, "email-change-current");
  const newEmail = `new-${randomUUID()}@learli.test`;
  await account.page.getByLabel("New test email").fill(newEmail);
  await account.page.getByLabel("Current-address code").fill(current.otp);
  await account.page.getByLabel("Current-address code").press("Tab");
  await account.page.keyboard.press("Enter");
  await expect(account.page.getByLabel("New-address code")).toBeVisible();
  return { newEmail, next: await capture(newEmail, "email-change-new") };
}

test("real current/new proof and native captured-link navigation work by keyboard on desktop and phones", async ({
  browser,
}) => {
  for (const width of [1440, 390, 320]) {
    await owner.pool.query("UPDATE rate_limit SET count=0");
    const account = await actor(browser, true, width);
    const other = await browser.newContext({ baseURL });
    try {
      expect((await signIn(other, account.email)).status()).toBe(200);
      const { page } = account;
      await page.goto("/account");
      await page.getByRole("link", { name: "Change account email" }).click();
      await expect(page).toHaveURL(/\/account\/email$/);
      await accessible(page);
      const value = await pending(account);
      expect(
        (
          await owner.pool.query('SELECT email FROM "user" WHERE id=$1', [
            account.id,
          ])
        ).rows[0].email === account.email,
      ).toBe(true);
      await expect(
        page.getByText(`Pending new email: ${value.newEmail}`),
      ).toBeVisible();
      await expect(page.getByLabel("New-address code")).toHaveValue("");
      await accessible(page);
      const capturePage = await account.context.newPage();
      await capturePage.goto(pathToFileURL(value.next.html).href);
      await capturePage
        .getByRole("link", { name: "Continue on local Learli" })
        .click();
      await expect(capturePage).toHaveURL(`${baseURL}/account/email`);
      expect(new URL(capturePage.url()).search).toBe("");
      await capturePage.close();
      await page.evaluate(() => {
        document.documentElement.dataset.oldEmailDocument = "yes";
      });
      await page.getByLabel("New-address code").fill(value.next.otp);
      await page.getByLabel("New-address code").press("Tab");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/account$/);
      await expect(
        page.getByText(`Signed in as ${value.newEmail}`),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.dataset.oldEmailDocument === undefined,
        ),
      ).toBe(true);
      expect((await other.request.get("/api/auth/get-session")).status()).toBe(
        200,
      );
      expect(
        Boolean(
          await (await other.request.get("/api/auth/get-session")).json(),
        ),
      ).toBe(false);
      expect((await signIn(other, account.email)).status()).toBe(401);
      expect((await signIn(other, value.newEmail)).status()).toBe(200);
      await accessible(page);
      expect(
        (await page.request.get("/account/email")).headers()["cache-control"],
      ).toContain("no-store");
    } finally {
      await account.context.close();
      await other.close();
    }
  }
});

test("real partial revocation failure stops retry and offers saved-account recovery", async ({
  browser,
}) => {
  const account = await actor(browser);
  const other = await browser.newContext({ baseURL });
  const name = `email_browser_failure_${randomUUID().replaceAll("-", "")}`;
  try {
    await signIn(other, account.email);
    const value = await pending(account);
    await owner.pool.query(
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN IF OLD.user_id=TG_ARGV[0] THEN RAISE EXCEPTION 'Synthetic revocation failure'; END IF; RETURN OLD; END $f$`,
    );
    await owner.pool.query(
      `CREATE TRIGGER ${name} BEFORE DELETE ON session FOR EACH ROW EXECUTE FUNCTION ${name}('${account.id}')`,
    );
    await account.page.getByLabel("New-address code").fill(value.next.otp);
    await account.page
      .getByRole("button", { name: "Confirm new address" })
      .click();
    await expect(
      account.page
        .getByRole("region", { name: "Verify new address" })
        .getByRole("alert"),
    ).toHaveText(/may already have changed/);
    await expect(
      account.page.getByRole("button", { name: "Confirm new address" }),
    ).toBeDisabled();
    await expect(account.page.getByLabel("New-address code")).toHaveValue("");
    await expect(
      account.page
        .getByRole("region", { name: "Verify new address" })
        .getByRole("alert"),
    ).toBeFocused();
    await accessible(account.page);
    expect(
      (
        await owner.pool.query('SELECT email FROM "user" WHERE id=$1', [
          account.id,
        ])
      ).rows[0].email === value.newEmail,
    ).toBe(true);
    await account.page
      .getByRole("link", { name: "Check saved account" })
      .click();
    await expect(
      account.page.getByText(`Signed in as ${value.newEmail}`),
    ).toBeVisible();
  } finally {
    await owner.pool.query(`DROP TRIGGER IF EXISTS ${name} ON session`);
    await owner.pool.query(`DROP FUNCTION IF EXISTS ${name}()`);
    await account.context.close();
    await other.close();
  }
});

test("no-JS mutation is disabled and stale/suspended/origin/raw-provider restrictions remain real", async ({
  browser,
}) => {
  const native = await actor(browser, false, 390);
  const account = await actor(browser);
  try {
    await native.page.goto("/account/email");
    await expect(
      native.page.getByText("Enable JavaScript to change your email here."),
    ).toBeVisible();
    await expect(
      native.page.getByRole("button", { name: "Send current-address code" }),
    ).toBeDisabled();
    await native.page.getByRole("link", { name: "Back to account" }).click();
    await expect(native.page).toHaveURL(/\/account$/);
    const value = await pending(account);
    await owner.pool.query(
      "UPDATE session SET created_at=clock_timestamp()-interval '25 hours' WHERE user_id=$1",
      [account.id],
    );
    await account.page.getByLabel("New-address code").fill(value.next.otp);
    await account.page
      .getByRole("button", { name: "Confirm new address" })
      .click();
    await expect(
      account.page
        .getByRole("region", { name: "Verify new address" })
        .getByRole("alert"),
    ).toHaveText(/Sign out, then sign in again/);
    await accessible(account.page);
    expect(
      (
        await account.context.request.post("/api/account/email", {
          headers: { origin: "https://foreign.test" },
          data: { action: "start" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await account.context.request.post("/api/auth/email-otp/change-email", {
          headers: { origin: baseURL },
          data: value,
        })
      ).status(),
    ).toBe(404);
    await owner.pool.query(
      "UPDATE user_access SET status='suspended' WHERE user_id=$1",
      [account.id],
    );
    await account.page.reload();
    await expect(
      account.page.getByRole("heading", { name: "Account access unavailable" }),
    ).toBeVisible();
  } finally {
    await native.context.close();
    await account.context.close();
  }
});

for (const width of [1440, 390]) {
  test(`inline email correction works by keyboard with private pending and completion at ${width}px`, async ({
    browser,
  }, info) => {
    const account = await actor(browser, true, width);
    const { page } = account;
    let release = () => {};
    try {
      await start(page);
      const current = await capture(account.email, "email-change-current");
      const email = page.getByLabel("New test email");
      const code = page.getByLabel("Current-address code");
      let mutations = 0;
      page.on("request", (request) => {
        if (
          new URL(request.url()).pathname === "/api/account/email" &&
          request.method() === "POST"
        )
          mutations++;
      });
      const newEmail = `corrected-${randomUUID()}@learli.test`;
      for (const invalid of [
        { email: true, code: true },
        { email: true, code: false },
        { email: false, code: true },
      ]) {
        await email.fill(invalid.email ? "not-an-address" : newEmail);
        await code.fill(invalid.code ? "" : "000000");
        await page
          .getByRole("button", { name: "Confirm current address" })
          .focus();
        await page.keyboard.press("Enter");
        await expect(invalid.email ? email : code).toBeFocused();
        await expect(email).toHaveAttribute(
          "aria-invalid",
          String(invalid.email),
        );
        await expect(code).toHaveAttribute(
          "aria-invalid",
          String(invalid.code),
        );
        if (invalid.email) {
          await expect(email).toHaveAttribute(
            "aria-describedby",
            "email-new-error",
          );
          await expect(email).toHaveAccessibleDescription(
            "Enter a synthetic .test email address.",
          );
        } else {
          await expect(email).not.toHaveAttribute("aria-describedby");
          await expect(email).toHaveValue(newEmail);
        }
        if (invalid.code) {
          await expect(code).toHaveAttribute(
            "aria-describedby",
            "email-code-error",
          );
          await expect(code).toHaveAccessibleDescription(
            "Enter the six-digit current-address code.",
          );
        } else await expect(code).not.toHaveAttribute("aria-describedby");
        expect(mutations).toBe(0);
        await expect(
          page
            .getByRole("region", { name: "Verify current address" })
            .getByRole("alert"),
        ).toHaveCount(0);
        if (invalid.email && invalid.code) {
          await accessible(page);
          await page.screenshot({
            path: info.outputPath(`inline-errors-${width}.png`),
            fullPage: true,
          });
        }
      }
      // Focus remains on the code. Correct it using the keyboard; address is retained.
      await page.keyboard.type(current.otp);
      await expect(code).toHaveAttribute("aria-invalid", "false");
      await expect(code).not.toHaveAttribute("aria-describedby");
      await expect(email).toHaveValue(newEmail);
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(
        "**/api/account/email",
        async (route) => {
          await gate;
          await route.continue();
        },
        { times: 1 },
      );
      await code.press("Tab");
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("button", { name: "Confirming…" }),
      ).toBeDisabled();
      await expect(
        page.getByText("Checking email confirmation."),
      ).toBeVisible();
      await expect(code).toHaveValue("");
      await expect(page.getByText(/Pending new email:/)).toHaveCount(0);
      release();
      const nextCode = page.getByLabel("New-address code");
      await expect(nextCode).toBeVisible();
      await expect(
        page
          .getByRole("region", { name: "Verify new address" })
          .getByRole("status"),
      ).toBeFocused();
      expect(mutations).toBe(1);
      const next = await capture(newEmail, "email-change-new");
      for (const malformed of ["", "letters"]) {
        await nextCode.fill(malformed);
        await page.getByRole("button", { name: "Confirm new address" }).focus();
        await page.keyboard.press("Enter");
        await expect(nextCode).toBeFocused();
        await expect(nextCode).toHaveAttribute("aria-invalid", "true");
        await expect(nextCode).toHaveAttribute(
          "aria-describedby",
          "email-code-error",
        );
        await expect(nextCode).toHaveAccessibleDescription(
          "Enter the six-digit new-address code.",
        );
        expect(mutations).toBe(1);
        if (!malformed) {
          await accessible(page);
          await page.screenshot({
            path: info.outputPath(`new-code-error-${width}.png`),
            fullPage: true,
          });
        }
      }
      await nextCode.press("ControlOrMeta+A");
      await page.keyboard.type(next.otp);
      await expect(nextCode).toHaveAttribute("aria-invalid", "false");
      await expect(nextCode).not.toHaveAttribute("aria-describedby");
      await expect(page.getByText(/Enter the six-digit/)).toHaveCount(0);
      expect(
        await page.evaluate(
          (proofs) => {
            const text = document.body.innerText;
            const stored = JSON.stringify([
              Object.values(localStorage),
              Object.values(sessionStorage),
            ]);
            return proofs.some(
              (proof) =>
                text.includes(proof) ||
                stored.includes(proof) ||
                location.href.includes(proof),
            );
          },
          [current.otp, next.otp],
        ),
      ).toBe(false);
      await page.evaluate(() => {
        document.documentElement.dataset.beforeEmailCompletion = "yes";
      });
      await nextCode.press("Tab");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/account$/);
      await expect(page.getByText(`Signed in as ${newEmail}`)).toBeVisible();
      expect(mutations).toBe(2);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.dataset.beforeEmailCompletion ===
            undefined,
        ),
      ).toBe(true);
      expect(
        await page.evaluate(
          (proofs) =>
            proofs.some(
              (proof) =>
                document.documentElement.outerHTML.includes(proof) ||
                location.href.includes(proof),
            ),
          [current.otp, next.otp],
        ),
      ).toBe(false);
      await accessible(page);
    } finally {
      release();
      await account.context.close();
    }
  });
}
