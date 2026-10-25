import type { EmailMessage } from "@/providers/email/registry";

// One simple, client-friendly email layout for every notification. Inline styles only:
// email clients ignore stylesheets.

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export interface EmailContent {
  to: string;
  businessName: string;
  title: string;
  body: string;
  /** Full URL of the button, if any */
  actionUrl?: string | null;
  actionLabel?: string;
}

export function buildEmail(c: EmailContent): EmailMessage {
  const paragraphs = c.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2b2f38">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = c.actionUrl
    ? `<a href="${esc(c.actionUrl)}" style="display:inline-block;margin-top:6px;padding:12px 20px;border-radius:12px;background:#2f45c5;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none">${esc(c.actionLabel ?? "Open Prodo")}</a>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:'Plus Jakarta Sans',Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e5eb;border-radius:16px">
<tr><td style="padding:28px 28px 8px"><span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#edf0fc;color:#2f45c5;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">${esc(c.businessName)} · Prodo</span></td></tr>
<tr><td style="padding:8px 28px 0"><h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#15171c">${esc(c.title)}</h1>${paragraphs}${button}</td></tr>
<tr><td style="padding:24px 28px 28px;font-size:12px;color:#8a909c">You get this because you asked Prodo to email you about your content. Change it in Settings → Automation.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [c.title, "", c.body, c.actionUrl ? `\n${c.actionLabel ?? "Open Prodo"}: ${c.actionUrl}` : ""].join("\n");
  return { to: c.to, subject: c.title, html, text };
}
