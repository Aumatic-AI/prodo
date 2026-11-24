import { createAdminClient } from "@/lib/supabase/admin";
import { businessDb } from "@/lib/supabase/business";
import { classify } from "@/core/errors";
import { formatCredits } from "@/config/credits";
import { notify } from "@/core/notifications/notify";
import { publisherFor } from "@/providers/publishing/registry";
import { creditBalance, spendCredits, type FeesDue } from "./ledger";
import { priceOf } from "./prices";

// The monthly fee for connected social accounts, taken on the 1st. When the balance can't cover it, the fee is
// kept as due (businesses.fees_due) and publishing waits: every top-up and every post tries to take it again.

const monthName = (month: string) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));

async function setFeesDue(businessId: string, due: FeesDue | null): Promise<void> {
  const { error } = await createAdminClient().from("businesses").update({ fees_due: due }).eq("id", businessId);
  if (error) throw error;
}

/** Connected accounts (live from the publishing provider). A business that never opened Connected accounts has none. */
export async function connectedAccountCount(businessId: string): Promise<number> {
  const db = businessDb(businessId);
  const { data } = await db.from("app_settings").select("zernio_profile_id").single();
  if (!data?.zernio_profile_id) return 0;
  return (await publisherFor().listAccounts(db)).length;
}

/** Takes this month's fee for `accounts` social accounts, once. Too few credits: the fee is kept as due and the client is told. */
export async function chargeAccountFee(businessId: string, accounts: number, month = new Date().toISOString().slice(0, 7)): Promise<{ charged: number } | { due: number }> {
  const credits = (await priceOf("social_account")) * accounts;
  const fee: FeesDue = {
    action: "social_account",
    credits,
    label: `${accounts} social account${accounts === 1 ? "" : "s"} · ${monthName(month)}`,
    key: `accounts:${month}`,
    since: new Date().toISOString(),
  };
  try {
    await spendCredits(businessId, fee, `This month's fee for ${accounts} social account${accounts === 1 ? "" : "s"}`);
    await setFeesDue(businessId, null);
    return { charged: credits };
  } catch (err) {
    if (classify(err).type !== "NO_CREDITS") throw err;
    await setFeesDue(businessId, fee);
    const { credits: have } = await creditBalance(businessId);
    await notify(businessDb(businessId), {
      kind: "credits_low",
      title: "Publishing is paused until credits are added",
      body: `This month's fee for your ${fee.label.split(" · ")[0]} is ${formatCredits(credits)} credits and your balance is ${formatCredits(have)}. Posts wait until the Prodo team adds credits; everything else you made is kept.`,
      link: "/credits",
      email: true,
      actionLabel: "See your credits",
    }).catch(() => undefined);
    return { due: credits };
  }
}

/**
 * Takes a fee that was due when there are now enough credits. Returns what is still due (null: nothing),
 * so publishing knows whether to wait.
 */
export async function collectFees(businessId: string): Promise<FeesDue | null> {
  const { credits, feesDue } = await creditBalance(businessId);
  if (!feesDue) return null;
  if (credits < feesDue.credits) return feesDue;
  try {
    await spendCredits(businessId, feesDue);
  } catch (err) {
    if (classify(err).type === "NO_CREDITS") return feesDue;
    throw err;
  }
  await setFeesDue(businessId, null);
  return null;
}
