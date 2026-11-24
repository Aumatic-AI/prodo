import type { SupabaseClient } from "@supabase/supabase-js";
import { CREDIT_ACTIONS, CREDIT_CATEGORIES, categoryOf, isCreditAction, type CreditCategory } from "@/config/credits";
import { creditBalance, type FeesDue } from "./ledger";
import { priceList, type CreditPrice } from "./prices";

// One month of a business's credits: the balance, what was used (by kind of work and by day), what was added,
// and every change. Shared by the client's Credits screen and the admin panel's business page.

export interface CreditRow {
  id: string;
  kind: "topup" | "adjust" | "charge" | "refund";
  credits: number;
  balance: number;
  action: string | null;
  label: string;
  ref_id: string | null;
  amount_usd: number | null;
  note: string | null;
  created_at: string;
}

export interface CategoryUse {
  key: CreditCategory | "other";
  label: string;
  /** Credits used: charges less refunds */
  used: number;
  /** How many things were made (charges less refunds) */
  uses: number;
}

export interface CreditsView {
  month: string;
  balance: number;
  feesDue: FeesDue | null;
  used: number;
  added: number;
  byCategory: CategoryUse[];
  byAction: { action: string; label: string; used: number; uses: number }[];
  byDay: { date: string; used: number }[];
  history: CreditRow[];
  prices: CreditPrice[];
}

const PAGE = 1000;
const MAX_PAGES = 20;

// A logged-in client may read only these columns (0032): admins' notes stay with the admin panel
const CLIENT_COLUMNS = "id, kind, credits, balance, action, label, ref_id, amount_usd, created_at";

/**
 * The month's rows, a page at a time (one query stops at the API's 1,000-row cap). `db` is limited to the business;
 * `notes` (admin panel, service role) adds the admins' notes.
 */
async function monthRows(db: SupabaseClient, start: string, end: string, notes: boolean): Promise<CreditRow[]> {
  const rows: CreditRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await db
      .from("credit_ledger")
      .select(notes ? `${CLIENT_COLUMNS}, note` : CLIENT_COLUMNS)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })
      .order("id")
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as CreditRow[]).map((r) => ({ ...r, note: r.note ?? null, amount_usd: r.amount_usd === null ? null : Number(r.amount_usd) })));
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)).toISOString(), end: new Date(Date.UTC(y, m, 1)).toISOString() };
}

/** Credits used per action, grouped into the high-level kinds of work (empty kinds left out) */
export function categoriesOf(rows: { action: string; used: number; uses: number }[]): CategoryUse[] {
  return [...CREDIT_CATEGORIES, { key: "other" as const, label: "Other" }]
    .map((c) => {
      const mine = rows.filter((r) => categoryOf(r.action) === c.key);
      return { key: c.key, label: c.label, used: mine.reduce((s, r) => s + r.used, 0), uses: mine.reduce((s, r) => s + r.uses, 0) };
    })
    .filter((c) => c.used !== 0 || c.uses !== 0);
}

/** Adds up used credits (charges less refunds) by category and by action */
export function summarise(rows: Pick<CreditRow, "kind" | "credits" | "action">[]) {
  const spending = rows.filter((r) => r.kind === "charge" || r.kind === "refund");
  const byAction = new Map<string, { used: number; uses: number }>();
  for (const r of spending) {
    const key = r.action ?? "other";
    const v = byAction.get(key) ?? { used: 0, uses: 0 };
    v.used += -r.credits;
    v.uses += r.kind === "charge" ? 1 : -1;
    byAction.set(key, v);
  }
  return {
    used: spending.reduce((s, r) => s - r.credits, 0),
    byCategory: categoriesOf([...byAction.entries()].map(([action, v]) => ({ action, ...v }))),
    byAction: [...byAction.entries()]
      .map(([action, v]) => ({ action, label: isCreditAction(action) ? CREDIT_ACTIONS[action].label : "Other", ...v }))
      .sort((a, b) => b.used - a.used),
  };
}

/** `notes`: only for the admin panel (a client's login can't read them) */
export async function loadCredits(db: SupabaseClient, businessId: string, month: string, { notes = false } = {}): Promise<CreditsView> {
  const { start, end } = monthRange(month);
  const [rows, balance, prices] = await Promise.all([monthRows(db, start, end, notes), creditBalance(businessId), priceList()]);
  const days = new Map<string, number>();
  for (const r of rows) {
    if (r.kind !== "charge" && r.kind !== "refund") continue;
    const day = r.created_at.slice(0, 10);
    days.set(day, (days.get(day) ?? 0) - r.credits);
  }
  return {
    month,
    balance: balance.credits,
    feesDue: balance.feesDue,
    added: rows.filter((r) => r.kind === "topup" || r.kind === "adjust").reduce((s, r) => s + r.credits, 0),
    ...summarise(rows),
    byDay: [...days.entries()].map(([date, used]) => ({ date, used })).sort((a, b) => a.date.localeCompare(b.date)),
    history: rows.slice(0, 400),
    prices,
  };
}
