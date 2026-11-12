import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { escapeHtml } from "./escape-html";

let wordmark: string | undefined;
type AccountEmailCopy = Readonly<{
  subject: string;
  preview: string;
  heading: string;
  introduction: string;
  action: string;
  guidance: string;
  ignore: string;
}>;

/** Presentation only; callers validate the genuine provider link first. */
export function renderAccountProofEmail(
  proofUrl: string,
  copy: AccountEmailCopy,
  code?: string,
) {
  const url = escapeHtml(proofUrl);
  wordmark ??= readFileSync(
    path.join(process.cwd(), "public/brand/learli-email-wordmark.png"),
  ).toString("base64");
  return {
    subject: copy.subject,
    text: [
      copy.heading,
      copy.introduction,
      ...(code ? [`Your confirmation code: ${code}`] : []),
      `${copy.action}:\n${proofUrl}`,
      copy.guidance,
      copy.ignore,
      "The Learli team",
    ].join("\n\n"),
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${copy.subject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f8f6;color:#131a3d;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${copy.preview}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f8f6;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #c9d3ce;border-radius:16px;">
            <tr>
              <td style="padding:32px 24px 28px;">
                <img src="cid:learli-wordmark" width="112" height="40" alt="learli" style="display:block;width:112px;height:40px;border:0;color:#1e2a78;font-size:28px;font-weight:bold;" />
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px;">
                <h1 style="margin:0 0 20px;color:#1e2a78;font-size:28px;font-weight:700;line-height:36px;">${copy.heading}</h1>
                <p style="margin:0 0 28px;font-size:16px;line-height:26px;">${copy.introduction}</p>
                ${code ? `<p style="margin:0 0 8px;color:#55605d;font-size:14px;line-height:22px;">Your confirmation code</p><p style="margin:0 0 28px;padding:16px;background-color:#f5f8f6;border:1px solid #c9d3ce;border-radius:10px;color:#1e2a78;font-family:monospace;font-size:32px;font-weight:700;letter-spacing:6px;line-height:40px;text-align:center;">${escapeHtml(code)}</p>` : ""}
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" bgcolor="#1e2a78" style="background-color:#1e2a78;border-radius:10px;mso-padding-alt:16px 24px;">
                      <a href="${url}" rel="noreferrer" style="display:inline-block;padding:16px 24px;border:1px solid #1e2a78;border-radius:10px;color:#ffffff;font-size:16px;font-weight:700;line-height:24px;text-align:center;text-decoration:none;">${copy.action}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;color:#55605d;font-size:14px;line-height:22px;">${copy.guidance}</p>
                <p style="margin:24px 0 28px;font-size:16px;line-height:26px;">${copy.ignore}</p>
                <p style="margin:0 0 28px;font-size:16px;line-height:26px;">The Learli team</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;border-top:1px solid #c9d3ce;">
                <p style="margin:0 0 8px;color:#55605d;font-size:13px;line-height:20px;">Button not working? Copy and paste this link into your browser:</p>
                <p style="margin:0;font-size:13px;line-height:20px;word-break:break-all;overflow-wrap:anywhere;">
                  <a href="${url}" rel="noreferrer" style="color:#0a7566;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">${url}</a>
                </p>
              </td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>`,
    attachments: [
      {
        filename: "learli-logo.png",
        content: wordmark,
        content_id: "learli-wordmark",
      },
    ],
  };
}
