import type { SupabaseClient } from "@supabase/supabase-js";
import { countryName } from "@/config/countries";

// Everything the Strategist may use, loaded once: the client's answers, offerings and proof
// (confirmed and pending), the brand kit, plus market context that can't be cited.

export interface StrategistInput {
  businessName: string;
  language: string;
  /** Onboarding answers by key (keys match ANSWER_LABELS in core/brand/sources) */
  answers: Record<string, string>;
  offerings: { id: string; name: string; kind: string; price: number | null; currency: string | null; benefits: string[]; audience: string | null; isHero: boolean; pending: boolean }[];
  proof: { id: string; kind: string; content: string; author: string | null }[];
  kit: string;
  /** Competitor gaps and baselines: shapes strategy, never cited as fact */
  marketNotes: string[];
  /** Hooks that already worked for the client */
  winningHooks: string[];
  /** The client's own "never say" words */
  avoidWords: string[];
}

const TONE_WORDS: Record<string, [string, string]> = {
  formal: ["casual", "formal"],
  playful: ["serious", "playful"],
  bold: ["calm", "bold"],
  technical: ["simple", "technical"],
};

export async function loadStrategistInput(db: SupabaseClient): Promise<StrategistInput> {
  const [profileRes, offeringsRes, proofRes, kitRes, competitorsRes, learningsRes, hooksRes] = await Promise.all([
    db.from("business_profile").select("*").eq("id", 1).single(),
    // Active ones plus the website's pending finds (not ones the client rejected)
    db.from("offerings").select("id, name, kind, price, currency, benefits, audience, is_hero, active, verified").or("active.eq.true,verified.eq.false"),
    db.from("proof_items").select("id, kind, content, author").limit(40),
    db.from("brand_kit").select("*").eq("id", 1).single(),
    db.from("competitors").select("name, analysis").not("analysis", "is", null),
    db.from("learnings").select("dimension, value, platform, score, insight").in("dimension", ["baseline", "format"]),
    db.from("hook_library").select("text").eq("source", "own_winner").order("score", { ascending: false }).limit(10),
  ]);
  const failed = [profileRes, offeringsRes, proofRes, kitRes, competitorsRes, learningsRes, hooksRes].find((r) => r.error);
  if (failed?.error) throw failed.error;

  const p = profileRes.data;
  const raw = p.onboarding ?? {};
  const tone = Object.entries(TONE_WORDS)
    .map(([axis, [left, right]]) => {
      const v = Number(p.tone?.[axis] ?? 50);
      return v >= 60 ? right : v <= 40 ? left : `between ${left} and ${right}`;
    })
    .join(", ");

  const answers: Record<string, string> = {
    description: p.description ?? "",
    goal: p.primary_goal ?? "",
    market: [raw.cities, (p.countries ?? []).map(countryName).join(", ")].filter(Boolean).join(" · "),
    tone,
    liked_brands: (p.liked_brands ?? []).join(", "),
    rules: [
      p.compliance?.avoid_words?.length ? `Never use: ${p.compliance.avoid_words.join(", ")}` : "",
      p.compliance?.disclaimers?.length ? `Disclaimers: ${p.compliance.disclaimers.join(" | ")}` : "",
    ]
      .filter(Boolean)
      .join(". "),
    faqs: (raw.faqs ?? []).join(" | "),
    area: [raw.area, raw.areas].filter(Boolean).join(" · "),
  };

  const k = kitRes.data;
  const kit = [
    k.colors?.primary && `Brand colours: ${[k.colors.primary, k.colors.secondary, k.colors.accent].filter(Boolean).join(", ")}`,
    k.fonts?.heading && `Fonts: ${k.fonts.heading} (headings), ${k.fonts.body} (body)`,
    k.photo_style && `Photo style: ${k.photo_style}`,
    k.layout_style && `Layout style: ${k.layout_style}`,
  ]
    .filter(Boolean)
    .join("\n");

  const marketNotes = [
    ...(competitorsRes.data ?? []).map((c) => {
      const a = c.analysis ?? {};
      return `Competitor ${c.name}: angles ${(a.angles ?? []).join("; ") || "unknown"}. Gaps we could own: ${(a.gaps ?? []).join("; ") || "unknown"}`;
    }),
    ...(learningsRes.data ?? []).filter((l) => l.insight).map((l) => `${l.platform ?? "all"}: ${l.insight}`),
  ];

  return {
    businessName: p.name ?? "",
    language: p.language ?? "en",
    answers,
    offerings: (offeringsRes.data ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      kind: o.kind,
      price: o.price === null ? null : Number(o.price),
      currency: o.currency,
      benefits: o.benefits ?? [],
      audience: o.audience,
      isHero: o.is_hero,
      pending: !o.verified,
    })),
    proof: (proofRes.data ?? []).map((r) => ({ id: r.id, kind: r.kind, content: r.content.slice(0, 400), author: r.author })),
    kit,
    marketNotes: marketNotes.slice(0, 20),
    winningHooks: (hooksRes.data ?? []).map((h) => h.text),
    avoidWords: p.compliance?.avoid_words ?? [],
  };
}
