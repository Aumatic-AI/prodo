import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { CREDIT_ACTIONS, type CreditAction } from "@/config/credits";
import { forgetPrices, priceList, type CreditPrice } from "@/core/credits/prices";

// The price list the admin edits: credits per action. New prices apply to actions started after the change
// (each server keeps the list for up to a minute); what was already charged stays as it was.

export const pricesSchema = z.object({
  prices: z
    .array(z.object({ action: z.enum(Object.keys(CREDIT_ACTIONS) as [CreditAction, ...CreditAction[]]), credits: z.number().int("Whole credits only").min(0, "At least 0").max(100_000) }))
    .min(1),
});

export async function savePrices(input: z.infer<typeof pricesSchema>): Promise<CreditPrice[]> {
  const rows = input.prices.map((p, i) => ({ action: p.action, credits: p.credits, label: CREDIT_ACTIONS[p.action].label, sort: (i + 1) * 10, updated_at: new Date().toISOString() }));
  const { error } = await createAdminClient().from("credit_prices").upsert(rows, { onConflict: "action" });
  if (error) throw error;
  forgetPrices();
  return priceList();
}
