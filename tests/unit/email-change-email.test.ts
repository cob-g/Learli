// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { renderEmailChangeEmail } from "@/lib/email/email-change-email";

vi.mock("server-only", () => ({}));

it.each(["email-change-current", "email-change-new"] as const)(
  "renders a private branded %s code without putting proof in navigation",
  (kind) => {
    const email = renderEmailChangeEmail({
      kind,
      to: "owner@example.test",
      url: "http://127.0.0.1:3000/account/email",
      otp: "123456",
    });
    document.documentElement.innerHTML = email.html;
    const purpose = kind === "email-change-current" ? "current" : "new";
    expect(email.subject).toBe(`Confirm your ${purpose} Learli email`);
    expect(document.querySelector("h1")).toHaveTextContent(
      `Verify your ${purpose} email`,
    );
    expect(email.text).toContain("Your confirmation code: 123456");
    expect(document.body).toHaveTextContent("123456");
    expect(email.text).toContain("five minutes");
    expect(email.text).toContain("only be used once");
    expect(email.text).toContain("signed-in Learli session");
    for (const link of document.querySelectorAll("a"))
      expect(link.getAttribute("href")).toBe(
        "http://127.0.0.1:3000/account/email",
      );
    expect(email.attachments[0].content_id).toBe("learli-wordmark");
    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      "cid:learli-wordmark",
    );
    expect(document.querySelector("script,iframe,form,link")).toBeNull();
  },
);

it("escapes the displayed code and account navigation", () => {
  const email = renderEmailChangeEmail({
    kind: "email-change-new",
    to: "owner@example.test",
    url: 'http://127.0.0.1:3000/account/email?x="<script>private</script>',
    otp: "<script>private</script>",
  });
  document.documentElement.innerHTML = email.html;
  expect(document.querySelector("script")).toBeNull();
});
