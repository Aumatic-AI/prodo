import { businessDb } from "@/lib/supabase/business";
import { ownRow } from "@/lib/supabase/own-row";
import { runAgentStep } from "@/agents/run";
import { ai } from "@/providers/ai/registry";
import { smoke, smokeBusinessId } from "./_run";

const businessId = await smokeBusinessId();
const db = businessDb(businessId);

// Writes one agent_runs row with tokens and cost
await smoke("agentStep logs to agent_runs", async () => {
  const reply = await runAgentStep(
    { agent: "brand_strategist", businessId, input: { test: true }, summary: (r: string) => `Smoke test said "${r}"` },
    async (track) => {
      const r = await ai.text("Reply with the single word: logged");
      track(r.usage);
      return r.data.trim();
    }
  );
  const { data } = await db.from("agent_runs").select("*").order("created_at", { ascending: false }).limit(1).single();
  return { result: { reply, row: data } };
});

// Budget 0 must block the next agent call, then the old budget is restored
await smoke("budget 0 blocks agents (expect BUDGET_REACHED)", async () => {
  const { data: before } = await db.from("app_settings").select("monthly_budget_usd").single();
  await ownRow(db.from("app_settings").update({ monthly_budget_usd: 0 }));
  try {
    await runAgentStep({ agent: "planner", businessId }, async () => "should not run");
    throw new Error("Agent ran with a $0 budget");
  } catch (err: any) {
    if (err?.type !== "BUDGET_REACHED") throw err;
    return { result: err.message };
  } finally {
    await ownRow(db.from("app_settings").update({ monthly_budget_usd: before?.monthly_budget_usd ?? 50 }));
  }
});
