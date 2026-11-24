import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { businessDb } from "@/lib/supabase/business";
import { AppError } from "@/core/errors";
import { collectFees } from "@/core/credits/fees";
import type { FeesDue } from "@/core/credits/ledger";
import { categoriesOf, loadCredits, type CategoryUse, type CreditRow, type CreditsView } from "@/core/credits/view";
import type { AdminUser } from "./guard";

// The admin panel's businesses: the list, one business in detail, making a business's login with its first
// credits, adding or removing credits, a new password, and the monthly AI safety cap. Service role only,
// always behind requireAdmin / adminHandler.

export interface AdminBusiness {
  id: string;
  name: string;
  logoKey: string | null;
  email: string | null;
  onboardingStatus: string;
  paused: boolean;
  credits: number;
  feesDue: FeesDue | null;
  budgetUsd: number;
  createdAt: string;
  usedMonth: number;
  used30d: number;
  addedTotal: number;
  paidUsd: number;
  lastTopupAt: string | null;
  costMonth: number;
  posts30d: number;
  lastActive: string | null;
}

interface Row {
  id: string;
  name: string;
  logo_key: string | null;
  email: string | null;
  onboarding_status: string;
  paused: boolean;
  credits: number;
  fees_due: FeesDue | null;
  budget_usd: number | string | null;
  created_at: string;
  used_month: number;
  used_30d: number;
  added_total: number;
  paid_usd: number | string;
  last_topup_at: string | null;
  cost_month: number | string;
  posts_30d: number;
  last_active: string | null;
}

const toBusiness = (r: Row): AdminBusiness => ({
  id: r.id,
  name: r.name,
  logoKey: r.logo_key,
  email: r.email,
  onboardingStatus: r.onboarding_status,
  paused: r.paused,
  credits: Number(r.credits),
  feesDue: r.fees_due,
  budgetUsd: Number(r.budget_usd ?? 0),
  createdAt: r.created_at,
  usedMonth: Number(r.used_month),
  used30d: Number(r.used_30d),
  addedTotal: Number(r.added_total),
  paidUsd: Number(r.paid_usd),
  lastTopupAt: r.last_topup_at,
  costMonth: Number(r.cost_month),
  posts30d: Number(r.posts_30d),
  lastActive: r.last_active,
});

export async function listBusinesses(): Promise<AdminBusiness[]> {
  const { data, error } = await createAdminClient().rpc("admin_businesses");
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toBusiness);
}

export async function getBusiness(id: string): Promise<AdminBusiness> {
  const { data, error } = await createAdminClient().rpc("admin_businesses", { p_business_id: id });
  if (error) throw error;
  const row = ((data ?? []) as Row[])[0];
  if (!row) throw new AppError("That business doesn't exist (any more).", "INVALID_INPUT", false);
  return toBusiness(row);
}

export interface SeriesPoint {
  bucket: string;
  used: number;
  added: number;
  paid: number;
  aiCost: number;
}

/** Credits used and added, money paid and our AI cost per day or month (every business, or one) */
export async function series(since: Date, until: Date, unit: "day" | "month", businessId?: string): Promise<SeriesPoint[]> {
  const { data, error } = await createAdminClient().rpc("admin_series", {
    p_since: since.toISOString(),
    p_until: until.toISOString(),
    p_unit: unit,
    p_business_id: businessId ?? null,
  });
  if (error) throw error;
  return ((data ?? []) as { bucket: string; used: number; added: number; paid: number | string; ai_cost: number | string }[]).map((r) => ({
    bucket: r.bucket,
    used: Number(r.used),
    added: Number(r.added),
    paid: Number(r.paid),
    aiCost: Number(r.ai_cost),
  }));
}

/** Credits used per business and action in a period */
export async function usageRows(since: Date, until: Date, businessId?: string): Promise<{ business_id: string; action: string; used: number; uses: number }[]> {
  const { data, error } = await createAdminClient().rpc("admin_usage", { p_since: since.toISOString(), p_until: until.toISOString(), p_business_id: businessId ?? null });
  if (error) throw error;
  return (data ?? []) as { business_id: string; action: string; used: number; uses: number }[];
}

export interface AdminBusinessDetail {
  business: AdminBusiness;
  /** This month: balance, use by kind of work, every change */
  month: CreditsView;
  /** Since the business started */
  allTime: { used: number; byCategory: CategoryUse[] };
  /** The last 6 months */
  monthly: SeriesPoint[];
  /** The last 30 days */
  daily: SeriesPoint[];
  /** Every time credits were added or removed, newest first */
  topups: (CreditRow & { by: string | null })[];
}

const DAY = 86_400_000;

export async function getBusinessDetail(id: string): Promise<AdminBusinessDetail> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const [business, month, allRows, monthly, daily, topups] = await Promise.all([
    getBusiness(id),
    loadCredits(businessDb(id), id, now.toISOString().slice(0, 7), { notes: true }),
    usageRows(new Date(0), new Date(now.getTime() + DAY), id),
    series(monthStart, new Date(now.getTime() + 1000), "month", id),
    series(new Date(now.getTime() - 29 * DAY), new Date(now.getTime() + 1000), "day", id),
    businessDb(id)
      .from("credit_ledger")
      .select("id, kind, credits, balance, action, label, ref_id, amount_usd, note, created_at, created_by")
      .in("kind", ["topup", "adjust"])
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (topups.error) throw topups.error;
  const admins = await adminEmails((topups.data ?? []).map((r) => r.created_by).filter(Boolean) as string[]);
  return {
    business,
    month,
    allTime: { used: allRows.reduce((s, r) => s + r.used, 0), byCategory: categoriesOf(allRows) },
    monthly,
    daily,
    topups: (topups.data ?? []).map(({ created_by, ...r }) => ({ ...(r as CreditRow), amount_usd: r.amount_usd === null ? null : Number(r.amount_usd), by: created_by ? (admins.get(created_by) ?? null) : null })),
  };
}

/** Admin logins' emails, for "added by" */
export async function adminEmails(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  const db = createAdminClient();
  const found = await Promise.all(unique.map((id) => db.auth.admin.getUserById(id).then((r) => [id, r.data.user?.email ?? ""] as const)));
  return new Map(found);
}

// ---------- Changes ----------

export const newBusinessSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters"),
  credits: z.number({ invalid_type_error: "Enter the credits to give" }).int("Credits are whole numbers").min(0, "Credits can't be below 0").max(1_000_000),
  amountUsd: z.number().min(0, "The amount can't be below 0").max(1_000_000).nullish(),
  note: z.string().trim().max(500).nullish(),
});

/**
 * A new business: its login (email and password, confirmed, no email sent) and its first credits. The database
 * makes the business and its settings for the new login (prodo_create_business); the client then logs in and
 * goes through onboarding.
 */
export async function createBusinessLogin(admin: AdminUser, input: z.infer<typeof newBusinessSchema>): Promise<AdminBusiness> {
  const db = createAdminClient();
  const { data, error } = await db.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true });
  if (error) {
    if (/already (been )?registered|already exists/i.test(error.message)) throw new AppError("A login with this email already exists.", "INVALID_INPUT", false);
    throw new AppError(`Supabase Auth (making the login) said: ${error.message}`, "INVALID_INPUT", false);
  }
  const userId = data.user.id;
  const { data: business, error: findError } = await db.from("businesses").select("id").eq("owner_id", userId).maybeSingle();
  if (findError || !business) {
    // No business came with the login: don't leave a login that can't do anything
    await db.auth.admin.deleteUser(userId).catch(() => undefined);
    throw new AppError("The login was made but its business wasn't, so it was removed again. Check that migration 0032 ran, then try again.", "NOT_CONFIGURED", false);
  }
  if (input.credits > 0) await addCredits(admin, business.id, { credits: input.credits, amountUsd: input.amountUsd ?? null, note: input.note ?? null });
  return getBusiness(business.id);
}

export const creditsSchema = z.object({
  /** + adds, - removes */
  credits: z.number({ invalid_type_error: "Enter the credits" }).int("Credits are whole numbers").min(-1_000_000).max(1_000_000).refine((n) => n !== 0, "Enter a number of credits other than 0"),
  amountUsd: z.number().min(0, "The amount can't be below 0").max(1_000_000).nullish(),
  note: z.string().trim().max(500).nullish(),
});

/** Adds (or removes) credits, then takes any monthly fee that was waiting for them. Returns the new balance. */
export async function addCredits(admin: AdminUser, businessId: string, input: z.infer<typeof creditsSchema>): Promise<number> {
  const { data, error } = await createAdminClient().rpc("credit_topup", {
    p_business_id: businessId,
    p_credits: input.credits,
    p_amount_usd: input.credits > 0 ? (input.amountUsd ?? null) : null,
    p_note: input.note ?? null,
    p_admin: admin.id,
  });
  if (error) throw new AppError(error.message.replace(/^.*?:\s*/, ""), "INVALID_INPUT", false);
  if (input.credits > 0) await collectFees(businessId).catch(() => undefined);
  return Number(data ?? 0);
}

export const passwordSchema = z.object({ password: z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters") });

/** A new password for the business's own login */
export async function setPassword(businessId: string, password: string): Promise<void> {
  const db = createAdminClient();
  const { data: business, error } = await db.from("businesses").select("owner_id").eq("id", businessId).maybeSingle();
  if (error) throw error;
  if (!business?.owner_id) throw new AppError("This business has no login of its own.", "INVALID_INPUT", false);
  const { error: authError } = await db.auth.admin.updateUserById(business.owner_id, { password });
  if (authError) throw new AppError(`Supabase Auth (changing the password) said: ${authError.message}`, "INVALID_INPUT", false);
}

export const settingsSchema = z.object({ budgetUsd: z.number().min(1, "At least $1").max(100_000) });

/** The monthly AI safety cap (our cost, in dollars): the agents stop for the month when it's reached */
export async function setBudget(businessId: string, budgetUsd: number): Promise<void> {
  const { error } = await createAdminClient().from("app_settings").update({ monthly_budget_usd: budgetUsd }).eq("business_id", businessId);
  if (error) throw error;
}
