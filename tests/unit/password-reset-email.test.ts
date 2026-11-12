// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderPasswordResetEmail } from "@/lib/email/password-reset-email";
vi.mock("server-only", () => ({}));
const proof =
  "http://127.0.0.1:3038/api/auth/reset-password/synthetic-preview-only?callbackURL=%2Freset-password";
describe("password-reset email presentation", () => {
  it("preserves the link, one-use/expiry guidance and original Learli branding", () => {
    const email = renderPasswordResetEmail(proof);
    document.documentElement.innerHTML = email.html;
    expect(email.subject).toBe("Reset your Learli password");
    expect(document.querySelector("h1")).toHaveTextContent(
      "Reset your password",
    );
    const links = [...document.querySelectorAll("a")];
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("Reset password");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      proof,
      proof,
    ]);
    expect(email.text).toContain(proof);
    expect(email.text).toContain("30 minutes");
    expect(email.text).toContain("only be used once");
    expect(email.text).toContain("Your password will stay the same");
    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      "cid:learli-wordmark",
    );
    expect(email.attachments[0].content_id).toBe("learli-wordmark");
    expect(document.querySelector("script,iframe,form,link")).toBeNull();
  });
  it("escapes HTML without altering the private destination", () => {
    const value = proof + '&example="<script>private</script>';
    const email = renderPasswordResetEmail(value);
    document.documentElement.innerHTML = email.html;
    expect(document.querySelector("script")).toBeNull();
    for (const link of document.querySelectorAll("a"))
      expect(link.getAttribute("href")).toBe(value);
  });
});
