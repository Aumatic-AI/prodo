import { env } from "@/config/env";
import { notConfigured } from "@/core/errors";
import { jsonOrThrow, request } from "@/providers/http";
import type { EmailMessage, EmailSender } from "./types";

const SERVICE = "Resend";

/** Sends one email through Resend (https://resend.com/docs/api-reference/emails/send-email). */
export class ResendSender implements EmailSender {
  id = "resend";

  async send(message: EmailMessage): Promise<{ id: string }> {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw notConfigured(SERVICE);
    const res = await request(SERVICE, "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    });
    const body = await jsonOrThrow<{ id: string }>(SERVICE, res, (b) => b?.message);
    return { id: body.id };
  }
}
