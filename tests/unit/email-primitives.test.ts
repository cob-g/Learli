// @vitest-environment jsdom
import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { escapeHtml } from "@/lib/email/escape-html";
import { mailboxSchema } from "@/lib/email/mailbox";
import { mailboxSchema as legacyMailboxSchema } from "@/lib/email/transactional-message";
import { escapeNoticeText } from "@/features/booking-notifications/template";

describe("mail HTML encoding", () => {
  it.each([
    ["", ""],
    ["&<>\"'", "&amp;&lt;&gt;&quot;&#39;"],
    [
      'Learner\'s <Math> & "Science"',
      "Learner&#39;s &lt;Math&gt; &amp; &quot;Science&quot;",
    ],
    ["&amp; &#39;", "&amp;amp; &amp;#39;"],
    ["Line one\nCafé — 数学 🧑🏽‍🎓\t", "Line one\nCafé — 数学 🧑🏽‍🎓\t"],
  ])("preserves exact encoded bytes for %j", (value, expected) => {
    expect(escapeHtml(value)).toBe(expected);
    expect(escapeNoticeText(value)).toBe(expected);
  });

  it("preserves the legacy notice API as the canonical function", () => {
    expect(escapeNoticeText).toBe(escapeHtml);
  });

  it("keeps untrusted text and either quoted attribute context intact", () => {
    const value = `Learner's <img src=x onerror="attack()"> & "topic"`;
    const escaped = escapeHtml(value);
    expect(escaped).toBe(
      "Learner&#39;s &lt;img src=x onerror=&quot;attack()&quot;&gt; &amp; &quot;topic&quot;",
    );
    const page = document.implementation.createHTMLDocument();
    page.body.innerHTML = `<p>${escaped}</p><a title="${escaped}" data-note='${escaped}'>Continue</a>`;
    expect(page.querySelector("p")?.textContent).toBe(value);
    expect(page.querySelector("img")).toBeNull();
    const link = page.querySelector("a");
    expect(link?.getAttribute("title")).toBe(value);
    expect(link?.getAttribute("data-note")).toBe(value);
    expect(link?.getAttributeNames()).toEqual(["title", "data-note"]);
  });
});

describe("mailbox syntax without application policy", () => {
  it("preserves the legacy schema export as the canonical schema", () => {
    expect(legacyMailboxSchema).toBe(mailboxSchema);
  });

  it.each([
    "account@example.test",
    "Student+tag@Example.COM",
    "o'neil@example.test",
    "a.b-c_d+tag@example-domain.test",
  ])("accepts %s without normalization or a synthetic-only rule", (value) => {
    expect(mailboxSchema.parse(value)).toBe(value);
  });

  it("accepts exactly 254 characters and rejects 255", () => {
    const value = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(56)}.test`;
    expect(value).toHaveLength(254);
    expect(mailboxSchema.parse(value)).toBe(value);
    expect(
      mailboxSchema.safeParse(value.replace("d.test", "dd.test")).success,
    ).toBe(false);
  });

  it.each([
    " account@example.test",
    "account@example.test ",
    "a..b@example.test",
    "a@example..test",
    "a@example.test\r\nBcc: other@example.test",
    "Display <a@example.test>",
    "a@example.test,b@example.test",
    '"quoted"@example.test',
    "élève@example.test",
    "a@例え.test",
    "a/b@example.test",
    "a@example",
    "a@-example.test",
    "a@example_test.test",
    "a@127.0.0.1",
    "",
    null,
    undefined,
    123,
    ["a@example.test"],
  ])("rejects %j without trimming or coercion", (value) => {
    expect(mailboxSchema.safeParse(value).success).toBe(false);
  });

  it("keeps hosted configuration importable in plain Node without server conditions", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "--eval",
        'const { parseHostedAuthConfig } = await import("./src/features/hosted-auth/config.ts"); if (typeof parseHostedAuthConfig !== "function") throw new Error("Missing config parser"); process.stdout.write("config-import-ok");',
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(output).toBe("config-import-ok");
  });
});
