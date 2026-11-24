import { createAdminClient } from "@/lib/supabase/admin";
import { CREDIT_ACTIONS, isCreditAction, type CreditAction } from "@/config/credits";

// The live price list (credit_prices, edited in the admin panel), kept for a minute per server process.
// Prices missing from the table fall back to the defaults in config/credits.ts.

export interface CreditPrice {
  action: CreditAction;
  credits: number;
  label: string;
}

const TTL_MS = 60_000;
let cached: { at: number; prices: Record<CreditAction, number> } | null = null;

export async function creditPrices(): Promise<Record<CreditAction, number>> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.prices;
  const prices = Object.fromEntries(Object.entries(CREDIT_ACTIONS).map(([k, v]) => [k, v.credits])) as Record<CreditAction, number>;
  const { data, error } = await createAdminClient().from("credit_prices").select("action, credits");
  if (error) throw error;
  for (const row of data ?? []) if (isCreditAction(row.action)) prices[row.action] = Number(row.credits);
  cached = { at: Date.now(), prices };
  return prices;
}

export async function priceOf(action: CreditAction): Promise<number> {
  return (await creditPrices())[action];
}

/** The list for screens: every action in the order of the price list, with its live price. */
export async function priceList(): Promise<CreditPrice[]> {
  const prices = await creditPrices();
  return (Object.keys(CREDIT_ACTIONS) as CreditAction[]).map((action) => ({ action, credits: prices[action], label: CREDIT_ACTIONS[action].label }));
}

/** After the admin changes a price */
export function forgetPrices(): void {
  cached = null;
}
