import { AppError } from "@/core/errors";
import { businessDb } from "@/lib/supabase/business";
import { formatCredits, type CreditAction } from "@/config/credits";
import { priceOf } from "./prices";

// Taking and giving back a business's credits. The database does the sums (credit_* functions, 0032): it locks
// the business row, refuses to go below zero and charges each key once, so retries never charge twice.
// Server only: these use the service role, limited to the one business.

export interface Charge {
  action: CreditAction;
  /** What the client sees in their history: "Image ad · Summer sale" */
  label: string;
  /** The slot, plan, media item, research run or asset it is for */
  refId?: string | null;
  /** Charged once per key; pass the same key to refund it */
  key: string;
  /** Overrides the price list (a monthly fee for several accounts) */
  credits?: number;
}

/** The plain message when the balance is too low; `what` is the action ("This video"). */
export function noCredits(needed: number, have: number, what: string): AppError {
  return new AppError(
    `Not enough credits: ${what} uses ${formatCredits(needed)} credit${needed === 1 ? "" : "s"} and ${have === 0 ? "none are" : `${formatCredits(have)} ${have === 1 ? "is" : "are"}`} left. Ask the Prodo team to add more.`,
    "NO_CREDITS",
    false
  );
}

const NO_CREDITS = /NO_CREDITS needed=(\d+) have=(\d+)/;

/** The balance and any monthly fee still due. */
export async function creditBalance(businessId: string): Promise<{ credits: number; feesDue: FeesDue | null }> {
  const { data, error } = await businessDb(businessId).rpc("credit_balance");
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { credits: number; fees_due: FeesDue | null } | undefined;
  return { credits: Number(row?.credits ?? 0), feesDue: row?.fees_due ?? null };
}

/** A monthly fee (social accounts) that couldn't be taken: publishing waits until it is. */
export interface FeesDue {
  credits: number;
  label: string;
  key: string;
  action: CreditAction;
  since: string;
}

/** Whether a charge with this key was made (a one-time charge like onboarding) */
export async function charged(businessId: string, key: string): Promise<boolean> {
  const { count, error } = await businessDb(businessId).from("credit_ledger").select("id", { count: "exact", head: true }).eq("key", key).eq("kind", "charge");
  if (error) throw error;
  return !!count;
}

/** Stops before any work starts when the balance can't cover it. */
export async function assertCredits(businessId: string, needed: number, what: string): Promise<void> {
  if (needed <= 0) return;
  const { credits } = await creditBalance(businessId);
  if (credits < needed) throw noCredits(needed, credits, what);
}

/** Takes the action's credits (once per key). Too few: throws NO_CREDITS and takes nothing. Returns the new balance. */
export async function spendCredits(businessId: string, charge: Charge, what = "This"): Promise<number> {
  const credits = charge.credits ?? (await priceOf(charge.action));
  const { data, error } = await businessDb(businessId).rpc("credit_spend", {
    p_credits: credits,
    p_action: charge.action,
    p_label: charge.label.slice(0, 200),
    p_ref_id: charge.refId ?? null,
    p_key: charge.key,
  });
  if (error) {
    const short = error.message?.match(NO_CREDITS);
    if (short) throw noCredits(Number(short[1]), Number(short[2]), what);
    throw error;
  }
  return Number(data ?? 0);
}

/**
 * Gives back the charge made with this key (once; nothing when there was none). Used where work failed, so it
 * never throws: a refund that can't be made is logged and the failure handling carries on.
 */
export async function refundCredits(businessId: string, key: string, label?: string): Promise<void> {
  const { error } = await businessDb(businessId).rpc("credit_refund", { p_key: key, p_label: label ?? null });
  if (error) console.error(`[credits] refund of ${key} for ${businessId} failed:`, error.message);
}

/** Charges, then does the work; when the work throws, the credits go back and the error goes on. */
export async function withCredits<T>(businessId: string, charge: Charge, what: string, work: () => Promise<T>): Promise<T> {
  await spendCredits(businessId, charge, what);
  try {
    return await work();
  } catch (err) {
    await refundCredits(businessId, charge.key);
    throw err;
  }
}
