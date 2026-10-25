import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import { userMessage } from "@/core/errors";
import { emailEnabled, emailSender } from "@/providers/email/registry";
import { buildEmail } from "./email-template";

// In-app notifications (notifications table), optionally also by email to Settings → notification email.
// Email sending stays off until EMAIL_ENABLED=1: the email is built and logged, and the row says 'skipped'.

export type NotificationKind = "plan_ready" | "item_needs_review" | "plan_scheduled" | "post_failed" | "ad_ready" | "agent_stopped" | "budget_reached" | "weekly_report";

export interface NotifyInput {
  kind: NotificationKind;
  title: string;
  body?: string;
  /** App path, e.g. /week */
  link?: string;
  /** Also email it (when a notification email is set) */
  email?: boolean;
  actionLabel?: string;
}

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  email_status: "none" | "pending" | "sent" | "skipped" | "failed";
}

export async function notify(db: SupabaseClient, input: NotifyInput): Promise<void> {
  const [{ data: settings }, { data: business }] = await Promise.all([
    db.from("app_settings").select("notify_email").eq("id", 1).single(),
    db.from("business_profile").select("name").eq("id", 1).single(),
  ]);
  const to = input.email ? (settings?.notify_email ?? null) : null;

  const { data: row, error } = await db
    .from("notifications")
    .insert({ kind: input.kind, title: input.title, body: input.body ?? null, link: input.link ?? null, email_status: to ? "pending" : "none", email_to: to })
    .select("id")
    .single();
  if (error) throw error;
  if (!to) return;

  const message = buildEmail({
    to,
    businessName: business?.name || "Your business",
    title: input.title,
    body: input.body ?? "",
    actionUrl: input.link && env.APP_URL ? `${env.APP_URL.replace(/\/$/, "")}${input.link}` : null,
    actionLabel: input.actionLabel,
  });

  if (!emailEnabled()) {
    console.info(`[email skipped: EMAIL_ENABLED is off] to=${to} subject="${message.subject}"`);
    await db.from("notifications").update({ email_status: "skipped", email_error: "Email sending is off" }).eq("id", row.id);
    return;
  }

  try {
    await emailSender().send(message);
    await db.from("notifications").update({ email_status: "sent", emailed_at: new Date().toISOString() }).eq("id", row.id);
  } catch (err) {
    // A failed email never fails the agent; the in-app notification is already there
    await db.from("notifications").update({ email_status: "failed", email_error: userMessage(err) }).eq("id", row.id);
  }
}

export async function listNotifications(db: SupabaseClient, limit = 100): Promise<{ items: Notification[]; unread: number }> {
  const [list, unread] = await Promise.all([
    db.from("notifications").select("id, kind, title, body, link, read_at, created_at, email_status").order("created_at", { ascending: false }).limit(limit),
    db.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  if (list.error) throw list.error;
  return { items: (list.data ?? []) as Notification[], unread: unread.count ?? 0 };
}

export async function markRead(db: SupabaseClient, ids: string[] | "all"): Promise<void> {
  let query = db.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (ids !== "all") query = query.in("id", ids);
  const { error } = await query;
  if (error) throw error;
}
