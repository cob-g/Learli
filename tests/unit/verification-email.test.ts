// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { renderVerificationEmail } from "@/lib/email/verification-email";

vi.mock("server-only", () => ({}));

const proof =
  "http://127.0.0.1:3038/api/auth/verify-email?token=synthetic-preview-only&callbackURL=%2Fsign-in";

describe("verification email presentation", () => {
  it("keeps the genuine URL in both the primary action and fallback", () => {
    const email = renderVerificationEmail(proof);
    document.documentElement.innerHTML = email.html;
    const actions = [...document.querySelectorAll("a")];
    expect(actions).toHaveLength(2);
    expect(actions[0]).toHaveTextContent("Verify email address");
    expect(actions[1]).toHaveTextContent(proof);
    expect(actions.map((link) => link.getAttribute("href"))).toEqual([
      proof,
      proof,
    ]);
    expect(document.querySelector("h1")).toHaveTextContent(
      "Verify your email address",
    );
    expect(email.text.split("\n")).toContain(proof);
    expect(email.text).toContain("sign in");
    expect(email.text).toContain("Keep this link private");
    expect(email.text).toContain("safely ignore this email");
  });

  it("embeds the actual supplied wordmark without a remote image or script", () => {
    const email = renderVerificationEmail(proof);
    document.documentElement.innerHTML = email.html;
    const images = [...document.querySelectorAll("img")];
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("alt", "learli");
    expect(images[0]).toHaveAttribute("src", "cid:learli-wordmark");
    expect(document.querySelector("script,iframe,form,link")).toBeNull();
    expect(email.attachments).toHaveLength(1);
    expect(email.attachments[0]!.content_id).toBe("learli-wordmark");
    const png = Buffer.from(email.attachments[0]!.content, "base64");
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(
      png.equals(readFileSync("public/brand/learli-email-wordmark.png")),
    ).toBe(true);
    expect(png.length).toBeLessThan(32_768);
  });

  it("escapes HTML characters without changing the destination", () => {
    const unusual = `${proof}&example=\"<script>alert('private')</script>`;
    const email = renderVerificationEmail(unusual);
    document.documentElement.innerHTML = email.html;
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelectorAll("a")).toHaveLength(2);
    for (const link of document.querySelectorAll("a"))
      expect(link.getAttribute("href")).toBe(unusual);
    expect(email.text).toContain(unusual);
  });
});
