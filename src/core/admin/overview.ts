import { createAdminClient } from "@/lib/supabase/admin";
import { CREDIT_USD, LOW_CREDITS } from "@/config/credits";
import { categoriesOf, monthRange, type CategoryUse } from "@/core/credits/view";
import { adminEmails, listBusinesses, series, usageRows, type AdminBusiness, type SeriesPoint } from "./businesses";

// The admin panel's overviews: the dashboard (money in, credits used, our AI cost, who needs credits), the
// month's usage per business by kind of work, and every top-up. All high level: no single charges.

const DAY = 86_400_000;

export interface MonthTotals {
  /** Money paid with top-ups (US dollars) */
  revenue: number;
  creditsAdded: number;
  creditsUsed: number;
  /** What the agents cost us (agent_runs) */
  aiCost: number;
}

export interface AdminDashboard {
  businesses: { total: number; active: number; settingUp: number; lowBalance: number; feesDue: number; creditsHeld: number };
  thisMonth: MonthTotals;
  lastMonth: MonthTotals;
  /** The last 30 days */
  daily: SeriesPoint[];
  /** The last 6 months */
  monthly: SeriesPoint[];
  byCategory: CategoryUse[];
  topUsers: { id: string; name: string; used: number }[];
  needCredits: AdminBusiness[];
  recentTopups: { id: string; businessId: string; name: string; credits: number; amountUsd: number | null; createdAt: string }[];
}

const totalsOf = (points: SeriesPoint[]): MonthTotals => ({
  revenue: points.reduce((s, p) => s + p.paid, 0),
  creditsAdded: points.reduce((s, p) => s + p.added, 0),
  creditsUsed: points.reduce((s, p) => s + p.used, 0),
  aiCost: points.reduce((s, p) => s + p.aiCost, 0),
});

export const nameOf = (b: Pick<AdminBusiness, "name" | "email">) => b.name || b.email || "Unnamed business";

export async function loadDashboard(): Promise<AdminDashboard> {
  const now = new Date();
  const soon = new Date(now.getTime() + 1000);
  const thisStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  // The same days of last month, so the change compares like with like
  const lastSameDay = new Date(lastStart.getTime() + (now.getTime() - thisStart.getTime()));
  const [businesses, daily, monthly, thisUsage, lastToDate, topups] = await Promise.all([
    listBusinesses(),
    series(new Date(now.getTime() - 29 * DAY), soon, "day"),
    series(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)), soon, "month"),
    usageRows(thisStart, soon),
    series(lastStart, lastSameDay, "month"),
    createAdminClient().from("credit_ledger").select("id, business_id, credits, amount_usd, created_at").eq("kind", "topup").order("created_at", { ascending: false }).limit(6),
  ]);
  if (topups.error) throw topups.error;
  const byId = new Map(businesses.map((b) => [b.id, b]));
  const used = new Map<string, number>();
  for (const r of thisUsage) used.set(r.business_id, (used.get(r.business_id) ?? 0) + r.used);
  const done = businesses.filter((b) => b.onboardingStatus === "done");

  return {
    businesses: {
      total: businesses.length,
      active: done.length,
      settingUp: businesses.length - done.length,
      lowBalance: done.filter((b) => b.credits < LOW_CREDITS).length,
      feesDue: businesses.filter((b) => b.feesDue).length,
      creditsHeld: businesses.reduce((s, b) => s + b.credits, 0),
    },
    thisMonth: totalsOf(monthly.filter((p) => p.bucket >= thisStart.toISOString().slice(0, 10))),
    lastMonth: totalsOf(lastToDate),
    daily,
    monthly,
    byCategory: categoriesOf(thisUsage),
    topUsers: [...used.entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, n]) => ({ id, name: byId.get(id) ? nameOf(byId.get(id)!) : "Removed business", used: n })),
    // Set up, and low (or a fee waiting): these are the ones to call
    needCredits: businesses
      .filter((b) => b.feesDue || (b.onboardingStatus === "done" && b.credits < LOW_CREDITS))
      .sort((a, b) => a.credits - b.credits)
      .slice(0, 6),
    recentTopups: (topups.data ?? []).map((t) => ({
      id: t.id,
      businessId: t.business_id,
      name: byId.get(t.business_id) ? nameOf(byId.get(t.business_id)!) : "Removed business",
      credits: t.credits,
      amountUsd: t.amount_usd === null ? null : Number(t.amount_usd),
      createdAt: t.created_at,
    })),
  };
}

/** The value of credits at list price, for margins */
export const creditsValue = (credits: number) => credits * CREDIT_USD;

export interface UsageView {
  month: string;
  total: number;
  categories: CategoryUse[];
  rows: { id: string; name: string; email: string | null; credits: number; used: number; byCategory: CategoryUse[]; aiCost: number }[];
}

/** One month: credits each business used, by kind of work, with what it cost us */
export async function loadUsage(month: string): Promise<UsageView> {
  const { start, end } = monthRange(month);
  const [businesses, rows, costs] = await Promise.all([listBusinesses(), usageRows(new Date(start), new Date(end)), aiCostByBusiness(start, end)]);
  const per = new Map<string, { action: string; used: number; uses: number }[]>();
  for (const r of rows) per.set(r.business_id, [...(per.get(r.business_id) ?? []), r]);
  const list = businesses
    .map((b) => {
      const mine = per.get(b.id) ?? [];
      return { id: b.id, name: nameOf(b), email: b.email, credits: b.credits, used: mine.reduce((s, r) => s + r.used, 0), byCategory: categoriesOf(mine), aiCost: costs.get(b.id) ?? 0 };
    })
    .filter((r) => r.used !== 0 || r.aiCost > 0)
    .sort((a, b) => b.used - a.used);
  return { month, total: list.reduce((s, r) => s + r.used, 0), categories: categoriesOf(rows), rows: list };
}

/** Our AI cost per business in a period (added up in the database) */
async function aiCostByBusiness(start: string, end: string): Promise<Map<string, number>> {
  const { data, error } = await createAdminClient().rpc("admin_ai_cost", { p_since: start, p_until: end });
  if (error) throw error;
  return new Map(((data ?? []) as { business_id: string; cost: number | string }[]).map((r) => [r.business_id, Number(r.cost)]));
}

export interface TopupRow {
  id: string;
  businessId: string;
  name: string;
  email: string | null;
  kind: "topup" | "adjust";
  credits: number;
  balance: number;
  amountUsd: number | null;
  note: string | null;
  by: string | null;
  createdAt: string;
}

/** Every time credits were added or removed in a month, newest first */
export async function listTopups(month: string): Promise<{ month: string; rows: TopupRow[]; credits: number; revenue: number }> {
  const { start, end } = monthRange(month);
  const db = createAdminClient();
  const [{ data, error }, businesses] = await Promise.all([
    db
      .from("credit_ledger")
      .select("id, business_id, kind, credits, balance, amount_usd, note, created_by, created_at")
      .in("kind", ["topup", "adjust"])
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })
      .limit(1000),
    listBusinesses(),
  ]);
  if (error) throw error;
  const byId = new Map(businesses.map((b) => [b.id, b]));
  const admins = await adminEmails((data ?? []).map((r) => r.created_by).filter(Boolean) as string[]);
  const rows: TopupRow[] = (data ?? []).map((r) => {
    const b = byId.get(r.business_id);
    return {
      id: r.id,
      businessId: r.business_id,
      name: b ? nameOf(b) : "Removed business",
      email: b?.email ?? null,
      kind: r.kind as TopupRow["kind"],
      credits: r.credits,
      balance: r.balance,
      amountUsd: r.amount_usd === null ? null : Number(r.amount_usd),
      note: r.note,
      by: r.created_by ? (admins.get(r.created_by) ?? null) : null,
      createdAt: r.created_at,
    };
  });
  return { month, rows, credits: rows.reduce((s, r) => s + r.credits, 0), revenue: rows.reduce((s, r) => s + (r.amountUsd ?? 0), 0) };
}
