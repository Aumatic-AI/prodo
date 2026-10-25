import { env } from "@/config/env";
import { ResendSender } from "./resend";
import type { EmailSender } from "./types";

/** True only when sending is switched on (EMAIL_ENABLED=1). Until then emails are built and logged, not sent. */
export function emailEnabled(): boolean {
  return env.EMAIL_ENABLED === "1" || env.EMAIL_ENABLED === "true";
}

export function emailSender(): EmailSender {
  return new ResendSender();
}

export type { EmailMessage, EmailSender } from "./types";
