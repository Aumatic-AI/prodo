import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceRef } from "./bible";

// Turns a claim's source refs into something the client can read ("Show sources").

export interface ResolvedSource {
  ref: SourceRef;
  kind: "passage" | "answer" | "offering" | "proof" | "kit" | "client";
  title: string;
  text: string;
  url: string | null;
}

/** Labels for the onboarding answers the Strategist may cite (keys match strategist/sources.ts). */
export const ANSWER_LABELS: Record<string, string> = {
  description: "About the business (your answer)",
  goal: "Main goal (your answer)",
  market: "Where you sell (your answer)",
  tone: "Tone of voice sliders (your answer)",
  liked_brands: "Brands you admire (your answer)",
  rules: "Words to avoid and disclaimers (your answer)",
  faqs: "Questions and objections (your answer)",
  area: "Where you work (your answer)",
  content: "Goals, formats and post styles (your answer)",
  industry: "Industry (your answer)",
};

const MAX_TEXT = 1200;

/** Source of a statement the client wrote or edited themselves. */
export const CLIENT_EDIT = "client";

export async function resolveSources(db: SupabaseClient, refs: SourceRef[]): Promise<ResolvedSource[]> {
  const ids = (prefix: string) => refs.filter((r) => r.startsWith(`${prefix}:`)).map((r) => r.slice(prefix.length + 1));
  const [chunks, offerings, proof, profile, kit, admired] = await Promise.all([
    ids("chunk").length ? db.from("brand_chunks").select("id, content, brand_sources(url, title)").in("id", ids("chunk")) : null,
    ids("offering").length ? db.from("offerings").select("id, name, description, benefits, url").in("id", ids("offering")) : null,
    ids("proof").length ? db.from("proof_items").select("id, kind, content, author, brand_sources(url)").in("id", ids("proof")) : null,
    ids("answer").length ? db.from("business_profile").select("*").single() : null,
    refs.includes("kit") ? db.from("brand_kit").select("colors, fonts, photo_style, layout_style").single() : null,
    ids("answer").includes("liked_brands") ? db.from("competitors").select("name").eq("relation", "inspiration").eq("source", "client") : null,
  ]);

  const out: ResolvedSource[] = [];
  for (const c of chunks?.data ?? []) {
    const src = c.brand_sources as unknown as { url: string | null; title: string | null } | null;
    out.push({ ref: `chunk:${c.id}`, kind: "passage", title: src?.title ?? "From your website or posts", text: c.content.slice(0, MAX_TEXT), url: src?.url ?? null });
  }
  for (const o of offerings?.data ?? []) {
    out.push({ ref: `offering:${o.id}`, kind: "offering", title: o.name, text: [o.description, ...(o.benefits ?? [])].filter(Boolean).join("\n"), url: o.url });
  }
  for (const p of proof?.data ?? []) {
    const src = p.brand_sources as unknown as { url: string | null } | null;
    out.push({ ref: `proof:${p.id}`, kind: "proof", title: [p.kind.replace("_", " "), p.author].filter(Boolean).join(" · "), text: p.content, url: src?.url ?? null });
  }
  if (profile?.data) {
    const p = profile.data;
    const raw = p.onboarding ?? {};
    const values: Record<string, string> = {
      description: p.description ?? "",
      goal: (p.content_prefs?.goals ?? (p.primary_goal ? [p.primary_goal] : [])).join(", then "),
      market: [(p.cities ?? []).join(", "), (p.countries ?? []).join(", ")].filter(Boolean).join(" · "),
      tone: Object.entries(p.tone ?? {}).map(([k, v]) => `${k}: ${v}/100`).join(", "),
      liked_brands: (admired?.data ?? []).map((c) => c.name).join(", "),
      rules: [...(p.compliance?.avoid_words ?? []), ...(p.compliance?.disclaimers ?? [])].join(" · "),
      faqs: (raw.faqs ?? []).join("\n"),
      area: [raw.area, raw.areas].filter(Boolean).join(" · "),
      content: [
        p.content_prefs?.goals?.length && `Goals: ${p.content_prefs.goals.join(", then ")}`,
        p.content_prefs?.image_styles?.length && `Image styles: ${p.content_prefs.image_styles.join(", ")}`,
        p.content_prefs?.video_styles?.length && `Video styles: ${p.content_prefs.video_styles.join(", ")}`,
      ]
        .filter(Boolean)
        .join(" · "),
      industry: p.industry ?? "",
    };
    for (const key of ids("answer")) {
      out.push({ ref: `answer:${key}`, kind: "answer", title: ANSWER_LABELS[key] ?? key, text: values[key] || "—", url: null });
    }
  }
  if (kit?.data) {
    const k = kit.data;
    out.push({
      ref: "kit",
      kind: "kit",
      title: "Your brand kit",
      text: [
        k.colors?.primary && `Colours: ${[k.colors.primary, k.colors.secondary, k.colors.accent].filter(Boolean).join(", ")}`,
        k.fonts?.heading && `Fonts: ${k.fonts.heading} / ${k.fonts.body}`,
        k.photo_style && `Photo style: ${k.photo_style}`,
        k.layout_style && `Layout: ${k.layout_style}`,
      ]
        .filter(Boolean)
        .join("\n"),
      url: null,
    });
  }
  if (refs.includes(CLIENT_EDIT)) out.push({ ref: CLIENT_EDIT, kind: "client", title: "Written by you", text: "You added or edited this in the Brand Bible.", url: null });
  // Same order as asked
  return refs.flatMap((r) => out.filter((o) => o.ref === r));
}
