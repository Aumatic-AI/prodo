export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Plain-text version for clients that don't show HTML */
  text: string;
}

export interface EmailSender {
  id: string;
  send(message: EmailMessage): Promise<{ id: string }>;
}
