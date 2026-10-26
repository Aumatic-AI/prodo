import type { SupabaseClient } from "@supabase/supabase-js";
import { getItem, getPlan, approvedBible } from "@/core/plans/plans";
import type { PlanItem } from "@/core/plans/types";
import { TEMPLATE_IDS, type TemplateId } from "@/core/creative/brief";
import { ai } from "@/providers/ai/registry";
import type { Usage } from "@/providers/usage";

// Everything the Creative Director may use for one slot. Only confirmed facts: active offerings,
// verified offers and proof. Brand Brain passages are searched by the slot's angle.

export interface CreativeContext {
  item: PlanItem;
  weekStart: string;
  business: { name: string; language: string; description: string; tone: string; goal: string | null };
  ctaLinks: Record<string, string>;
  avoidWords: string[];
  disclaimers: string[];
  bible: { positioning: string; valueProp: string; tone: string; traits: string[]; examples: string[]; dos: string[]; donts: string[]; neverSay: string[]; visualRules: string[] };
  persona: { id: string; name: string; summary: string | null; pains: string[]; desires: string[]; objections: string[]; triggers: string[]; phrases: string[] } | null;
  pillar: { name: string; description: string | null } | null;
  offering: { id: string; name: string; kind: string; description: string | null; price: number | null; currency: string | null; priceModel: string | null; benefits: string[]; objections: string[]; audience: string | null; url: string | null } | null;
  offer: { id: string; title: string; details: string | null; code: string | null; endsAt: string | null } | null;
  proof: { id: string; kind: string; content: string; author: string | null; rating: number | null }[];
  assets: { id: string; kind: string; description: string | null; offeringId: string | null; storageKey: string }[];
  passages: { id: string; text: string }[];
  recentHooks: string[];
  photoStyle: string | null;
  /** Ad layouts the brand uses (Brand kit); all when none were picked */
  layouts: TemplateId[];
}

const TONE_WORDS: Record<string, [string, string]> = { formal: ["casual", "formal"], playful: ["serious", "playful"], bold: ["calm", "bold"], technical: ["simple", "technical"] };

function toneLine(tone: Record<string, number> | null): string {
  return Object.entries(TONE_WORDS)
    .map(([axis, [left, right]]) => {
      const v = Number(tone?.[axis] ?? 50);
      return v >= 60 ? right : v <= 40 ? left : `between ${left} and ${right}`;
    })
    .join(", ");
}

const texts = (claims: any[] | undefined) => (claims ?? []).map((c) => c?.text).filter(Boolean) as string[];

export async function loadCreativeContext(db: SupabaseClient, itemId: string): Promise<{ ctx: CreativeContext; usage: Usage | null }> {
  const item = await getItem(db, itemId);
  const [plan, bible] = await Promise.all([getPlan(db, item.plan_id), approvedBible(db)]);
  const [profile, persona, pillar, offering, offer, proof, assets, kit, hooks] = await Promise.all([
    db.from("business_profile").select("*").single(),
    item.persona_id ? db.from("personas").select("*").eq("id", item.persona_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    item.pillar_id ? db.from("content_pillars").select("name, description").eq("id", item.pillar_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    item.offering_id ? db.from("offerings").select("*").eq("id", item.offering_id).eq("active", true).maybeSingle() : Promise.resolve({ data: null, error: null }),
    item.offer_id ? db.from("offers").select("*").eq("id", item.offer_id).eq("active", true).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db
      .from("proof_items")
      .select("id, kind, content, author, rating, offering_id")
      .eq("verified", true)
      .or(item.offering_id ? `offering_id.is.null,offering_id.eq.${item.offering_id}` : "offering_id.is.null")
      .limit(12),
    db.from("brand_assets").select("id, kind, ai_description, offering_id, storage_key, tags").neq("kind", "reference_video").neq("kind", "doc").limit(40),
    db.from("brand_kit").select("photo_style, template_ids").single(),
    db.from("hook_library").select("text").order("created_at", { ascending: false }).limit(25),
  ]);
  for (const r of [profile, persona, pillar, offering, offer, proof, assets, kit, hooks]) if (r.error) throw r.error;

  // Brand Brain passages about this slot's angle and offering
  const query = [item.angle, offering.data?.name, item.objective].filter(Boolean).join(" · ");
  let usage: Usage | null = null;
  let passages: { id: string; text: string }[] = [];
  if (query) {
    const vec = await ai.embed([query]);
    usage = vec.usage;
    const { data, error } = await db.rpc("match_brand_chunks", { query_embedding: JSON.stringify(vec.data[0]), match_count: 6, filter: {} });
    if (error) throw error;
    passages = (data ?? []).filter((r: any) => r.metadata?.kind !== "competitor").map((r: any) => ({ id: r.id, text: String(r.content).slice(0, 900) }));
  }

  const p = profile.data;
  const c = bible.content ?? {};
  const offerRow = offer.data;
  // Photos of this offering first, then general brand photos
  const assetRows = (assets.data ?? []).sort((a, b) => Number(b.offering_id === item.offering_id) - Number(a.offering_id === item.offering_id)).slice(0, 12);

  return {
    usage,
    ctx: {
      item,
      weekStart: plan.week_start,
      business: { name: p.name, language: p.language || "en", description: p.description ?? "", tone: toneLine(p.tone), goal: p.primary_goal },
      ctaLinks: Object.fromEntries(Object.entries({ website: p.website, ...(p.cta_links ?? {}) }).filter(([, v]) => typeof v === "string" && v)) as Record<string, string>,
      avoidWords: p.compliance?.avoid_words ?? [],
      disclaimers: p.compliance?.disclaimers ?? [],
      bible: {
        positioning: c.positioning?.text ?? "",
        valueProp: c.value_prop?.text ?? "",
        tone: c.tone_guide?.summary?.text ?? "",
        traits: texts(c.tone_guide?.traits),
        examples: c.tone_guide?.examples ?? [],
        dos: texts(c.do_dont?.do),
        donts: texts(c.do_dont?.dont),
        neverSay: c.never_say ?? [],
        visualRules: texts(c.visual_rules),
      },
      persona: persona.data
        ? {
            id: persona.data.id,
            name: persona.data.name,
            summary: persona.data.summary,
            pains: persona.data.pains ?? [],
            desires: persona.data.desires ?? [],
            objections: persona.data.objections ?? [],
            triggers: persona.data.triggers ?? [],
            phrases: persona.data.phrases ?? [],
          }
        : null,
      pillar: pillar.data ?? null,
      offering: offering.data
        ? {
            id: offering.data.id,
            name: offering.data.name,
            kind: offering.data.kind,
            description: offering.data.description,
            price: offering.data.price,
            currency: offering.data.currency,
            priceModel: offering.data.price_model,
            benefits: offering.data.benefits ?? [],
            objections: offering.data.objections ?? [],
            audience: offering.data.audience,
            url: offering.data.url,
          }
        : null,
      // An offer the client hasn't confirmed is never used
      offer: offerRow && offerRow.verified !== false ? { id: offerRow.id, title: offerRow.title, details: offerRow.details, code: offerRow.code, endsAt: offerRow.ends_at } : null,
      proof: (proof.data ?? []).map((r) => ({ id: r.id, kind: r.kind, content: r.content, author: r.author, rating: r.rating })),
      assets: assetRows.map((a) => ({ id: a.id, kind: a.kind, description: a.ai_description ?? (a.tags ?? []).join(", ") ?? null, offeringId: a.offering_id, storageKey: a.storage_key })),
      passages,
      recentHooks: (hooks.data ?? []).map((h) => h.text),
      photoStyle: kit.data?.photo_style ?? null,
      layouts: ((kit.data?.template_ids ?? []) as string[]).filter((t): t is TemplateId => (TEMPLATE_IDS as readonly string[]).includes(t)).length
        ? (kit.data!.template_ids as TemplateId[])
        : [...TEMPLATE_IDS],
    },
  };
}
