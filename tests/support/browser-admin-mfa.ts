// Trusted synthetic setup still enrolls/verifies through actual provider HTTP.
// Keep trace/video/screenshot off whenever this helper or a factor challenge runs.
import type { BrowserContext, Page } from "@playwright/test";
import { totpCode } from "./admin-mfa";
const secrets = new Map<string, string>();
export async function enrollBrowserAdmin(
  context: BrowserContext,
  password: string,
) {
  const origin = process.env.APP_URL!;
  const current = await (
    await context.request.get("/api/auth/get-session")
  ).json();
  if (!current?.user?.id)
    throw new Error("Browser fixture needs a real signed-in session.");
  let secret = secrets.get(current.user.id);
  if (!current.user.twoFactorEnabled) {
    const response = await context.request.post("/api/auth/two-factor/enable", {
      headers: { origin },
      data: { password },
    });
    if (!response.ok()) throw new Error("Browser provider enrollment refused.");
    secret = (await response.json()).secret;
    if (typeof secret !== "string")
      throw new Error("Browser provider key unavailable.");
    secrets.set(current.user.id, secret);
    secrets.set(current.user.email, secret);
  }
  if (!secret) throw new Error("Browser provider authenticator unavailable.");
  const response = await context.request.post(
    "/api/auth/two-factor/verify-totp",
    { headers: { origin }, data: { code: totpCode(secret) } },
  );
  if (!response.ok()) throw new Error("Browser provider verification refused.");
}
export async function completeBrowserAdminChallenge(page: Page, email: string) {
  const secret = secrets.get(email);
  if (!secret) throw new Error("Browser challenge authenticator unavailable.");
  await page
    .getByLabel("Authenticator code", { exact: true })
    .fill(totpCode(secret));
  await page
    .getByRole("button", { name: "Verify administrator access", exact: true })
    .click();
}

// Installed Playwright1.64 omits failure DOM snapshots with this switch; keys/codes
// must never enter error-context artifacts. Status/error assertions remain intact.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
