import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS } from "@/config/models";
import { LABELS, type Brief } from "@/core/creative/brief";
import { getItem, updateItem } from "@/core/plans/plans";
import type { QaReport } from "@/core/plans/types";
import { ai } from "@/providers/ai/registry";
import { QA_BRIEF_SYSTEM, briefScoreSchema, overallScore } from "@/prompts/agents/qa-brief";
import type { Task } from "@/agents/weekly/task";

// Agent 8 · QA Critic, Gate 1: scores the brief (AI) on hook, one message, persona fit, CTA, proof
// and compliance, and adds the Creative Director's open code problems. Below 7 goes back.

export const PASS_SCORE = 7;

export interface Gate1Result {
  passed: boolean;
  score: number;
  fixes: string[];
  summary: string;
}

async function describeSlot(db: SupabaseClient, itemId: string): Promise<string> {
  const item = await getItem(db, itemId);
  const [persona, offering, profile] = await Promise.all([
    item.persona_id ? db.from("personas").select("name, summary, pains, desires").eq("id", item.persona_id).maybeSingle() : Promise.resolve({ data: null }),
    item.offering_id ? db.from("offerings").select("name, price, currency, benefits").eq("id", item.offering_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("business_profile").select("name, compliance").single(),
  ]);
  const lines = [
    `Business: ${profile.data?.name}`,
    `Platforms: ${item.platforms.join(", ")} · format: ${LABELS.format[item.format]} · funnel stage: ${item.funnel_stage}`,
    `Angle: ${item.angle} · objective: ${item.objective}`,
  ];
  if (persona.data) lines.push(`Persona: ${persona.data.name}: ${persona.data.summary ?? ""} Pains: ${(persona.data.pains ?? []).join("; ")}`);
  if (offering.data) lines.push(`Offering: ${offering.data.name}${offering.data.price !== null ? ` (${offering.data.price} ${offering.data.currency ?? ""})` : ""}`);
  const c = profile.data?.compliance;
  if (c?.avoid_words?.length) lines.push(`Never say: ${c.avoid_words.join(", ")}`);
  if (c?.disclaimers?.length) lines.push(`Required disclaimers: ${c.disclaimers.join(" | ")}`);
  return lines.join("\n");
}

export async function gate1(task: Task, db: () => SupabaseClient, itemId: string, round: number, brief: Brief, codeProblems: string[]): Promise<Gate1Result> {
  return task(
    `qa-brief-${round}`,
    async (track) => {
      const slot = await describeSlot(db(), itemId);
      const res = await ai.structured(briefScoreSchema, `${slot}\n\nBRIEF\n${JSON.stringify(brief, null, 1)}`, { system: QA_BRIEF_SYSTEM, model: MODELS.critic });
      track(res.usage);
      const score = overallScore(res.data.scores);
      const passed = score >= PASS_SCORE && res.data.scores.compliance >= PASS_SCORE && !codeProblems.length;
      const fixes = [...codeProblems, ...res.data.fixes];

      const item = await getItem(db(), itemId);
      const report: QaReport = { ...(item.qa_report ?? {}), gate1: { score, notes: res.data.summary, scores: res.data.scores, attempts: round + 1 } };
      await updateItem(db(), itemId, { brief_score: score, qa_report: report });
      return { passed, score, fixes, summary: res.data.summary };
    },
    (r) => `Brief scored ${r.score}/10${r.passed ? ", passed" : `, sent back: ${r.fixes[0] ?? "below 7"}`}`
  );
}
