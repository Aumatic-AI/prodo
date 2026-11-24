import { formatCredits, type CreditAction } from "@/config/credits";
import { assertCredits } from "./ledger";
import { creditPrices } from "./prices";
import { itemAction, itemWhat, type ItemForCredits } from "./items";

// "No credits, no start": the screens' actions check the balance before anything is started, so the client
// hears it at once instead of from a failed post. The runs themselves take the credits.

/** What a list of posts costs, plus extra actions (a weekly plan's own credits) */
export async function costOf(items: ItemForCredits[], extra: CreditAction[] = []): Promise<number> {
  const prices = await creditPrices();
  return items.reduce((sum, item) => sum + prices[itemAction(item)], 0) + extra.reduce((sum, a) => sum + prices[a], 0);
}

/** One post: "This video uses 70 credits…" */
export async function assertItemCredits(businessId: string, item: ItemForCredits): Promise<void> {
  await assertCredits(businessId, await costOf([item]), itemWhat(item.format));
}

/** Several posts at once (Auto-create, a weekly plan): all of them or none. `what` names the whole ("This week's plan"). */
export async function assertItemsCredits(businessId: string, items: ItemForCredits[], extra: CreditAction[] = [], what?: string): Promise<void> {
  const total = await costOf(items, extra);
  const count = items.length;
  await assertCredits(businessId, total, `${what ?? "This batch"} (${formatCredits(count)} post${count === 1 ? "" : "s"})`);
}
