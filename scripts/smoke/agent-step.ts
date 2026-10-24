import { createAdminClient } from "@/lib/supabase/admin";
import { runAgentStep } from "@/agents/run";
import { ai } from "@/providers/ai/registry";
import { smoke } from "./_run";

const db = createAdminClient();

// Writes one agent_runs row with tokens and cost
await smoke("agentStep logs to agent_runs", async () => {
  const reply = await runAgentStep(
    { agent: "brand_strategist", input: { test: true }, summary: (r: string) => `Smoke test said "${r}"` },
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
  const { data: before } = await db.from("app_settings").select("monthly_budget_usd").eq("id", 1).single();
  await db.from("app_settings").update({ monthly_budget_usd: 0 }).eq("id", 1);
  try {
    await runAgentStep({ agent: "planner" }, async () => "should not run");
    throw new Error("Agent ran with a $0 budget");
  } catch (err: any) {
    if (err?.type !== "BUDGET_REACHED") throw err;
    return { result: err.message };
  } finally {
    await db.from("app_settings").update({ monthly_budget_usd: before?.monthly_budget_usd ?? 50 }).eq("id", 1);
  }
});
