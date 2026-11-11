import type { SupabaseClient } from "@supabase/supabase-js";
import { getItem, getPlan, approvedBible } from "@/core/plans/plans";
import type { BibleStrategy } from "@/core/brand/bible";
import type { PlanItem } from "@/core/plans/types";
import { TEMPLATE_IDS, type TemplateId } from "@/core/creative/brief";
import { contentRules, type ContentRules } from "@/core/content/prefs";
import { layoutsFor } from "@/core/content/styles";
import { loadMoments, referenceLessons, type Moment } from "@/core/brand/footage";
import type { ReferenceVideo } from "@/prompts/agents/reference-video";
import { loadReference } from "./reference";
import { ai } from "@/providers/ai/registry";
import type { Usage } from "@/providers/usage";

// Everything the Creative Director may use for one slot. Only confirmed facts: active offerings,
// verified offers and proof. Brand Brain passages are searched by the slot's angle. The client's
// content choices (styles, people, logo, next step, music) come along as rules.

export interface CreativeContext {
  item: PlanItem;
  weekStart: string;
  business: { name: string; language: string; description: string; tone: string; goals: string[]; yearsInBusiness?: number | null };
  /** The client's onboarding choices */
  rules: ContentRules;
  ctaLinks: Record<string, string>;
  avoidWords: string[];
  bible: { positioning: string; valueProp: string; tone: string; traits: string[]; examples: string[]; dos: string[]; donts: string[]; neverSay: string[]; visualRules: string[]; strategy: BibleStrategy | null };
  persona: { id: string; name: string; summary: string | null; pains: string[]; desires: string[]; objections: string[]; triggers: string[]; phrases: string[] } | null;
  pillar: { name: string; description: string | null } | null;
  offering: { id: string; name: string; kind: string; description: string | null; price: number | null; currency: string | null; priceModel: string | null; benefits: string[]; objections: string[]; audience: string | null; url: string | null; attributes?: Record<string, unknown> } | null;
  offer: { id: string; title: string; details: string | null; code: string | null; endsAt: string | null } | null;
  proof: { id: string; kind: string; content: string; author: string | null; rating: number | null }[];
  /** The client's own photos; `offeringName` says which product a product photo shows */
  assets: { id: string; kind: string; description: string | null; offeringId: string | null; offeringName: string | null; storageKey: string }[];
  passages: { id: string; text: string }[];
  recentHooks: string[];
  photoStyle: string | null;
  /** How the brand's layouts look, and its website's signature look and motion (brand kit) */
  layoutStyle: string | null;
  designLanguage: string | null;
  /** Ad layouts this slot may use: its style's, narrowed to the brand kit's picks when they fit */
  layouts: TemplateId[];
  /** The business's last image ads' designs, newest first, so the next one looks different */
  recentDesigns: { layout: TemplateId; align: string; headlineCase: string; priceStyle: string }[];
  /** The idea and picture of the business's last image ads, newest first, so a free ad is a different idea */
  recentConcepts: string[];
  /** What the brand's logo looks like to the art director, or null when no logo goes on the ad */
  logoTone: "dark" | "light" | "both" | null;
  /** Video slots: usable moments of the client's own videos (best first) */
  moments: Moment[];
  /** Video slots: what the client's reference videos do well (pacing, structure), never copied */
  lessons: string[];
  /** Video slots made from a reference video: its scene-by-scene breakdown, to make the same video for this product */
  reference?: ReferenceVideo | null;
  /** Brand tone sliders (0–100), for the video look */
  tone: Record<string, number>;
  industry: string | null;
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
    // The client's own photos only: references are other brands' posts, never used as ours
    db
      .from("brand_assets")
      .select("id, kind, ai_description, offering_id, storage_key, tags, offerings(name)")
      .in("kind", ["product_photo", "person", "general", "team", "location", "work"])
      .limit(60),
    db.from("brand_kit").select("photo_style, layout_style, design_language, template_ids, logo_variants").single(),
    db.from("hook_library").select("text").order("created_at", { ascending: false }).limit(25),
  ]);
  for (const r of [profile, persona, pillar, offering, offer, proof, assets, kit, hooks]) if (r.error) throw r.error;

  // Image ads: the last image ads' designs (any week), so this one doesn't repeat them
  const { data: recent, error: recentError } =
    item.format === "static"
      ? await db.from("plan_items").select("brief").eq("format", "static").neq("id", item.id).not("brief", "is", null).order("created_at", { ascending: false }).limit(4)
      : { data: [], error: null };
  if (recentError) throw recentError;
  const recentDesigns = (recent ?? []).flatMap((r) => {
    const b = r.brief as { layout?: string; design?: { align?: string; headlineCase?: string; priceStyle?: string } } | null;
    return b?.layout && (TEMPLATE_IDS as readonly string[]).includes(b.layout)
      ? [{ layout: b.layout as TemplateId, align: b.design?.align ?? "left", headlineCase: b.design?.headlineCase ?? "normal", priceStyle: b.design?.priceStyle ?? "circle" }]
      : [];
  });

  const recentConcepts = (recent ?? []).flatMap((r) => {
    const b = r.brief as { message?: string; imagePrompt?: string } | null;
    return b?.message ? [`${b.message}${b.imagePrompt ? ` · picture: ${b.imagePrompt.replace(/\s+/g, " ").slice(0, 160)}` : ""}`] : [];
  });

  // Videos: the client's own footage and their reference videos' lessons
  const video = item.format === "video";
  const people = contentRules(profile.data).people;
  const [moments, lessons] = video ? await Promise.all([loadMoments(db, { offeringId: item.offering_id, people }), referenceLessons(db)]) : [[], []];
  // The post's own reference video, watched before the brief (produce-item)
  const reference = video && item.reference_video_id ? await loadReference(db, item.reference_video_id) : null;

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
  const rules = contentRules(p);
  // Photos of this offering first, then general brand photos; no photos of people when the client wants none
  const assetRows = (assets.data ?? [])
    .filter((a) => !/\.(mp4|mov)$/i.test(a.storage_key))
    .filter((a) => rules.people !== "none" || !["person", "team"].includes(a.kind))
    .sort((a, b) => Number(b.offering_id === item.offering_id) - Number(a.offering_id === item.offering_id))
    .slice(0, 12);

  return {
    usage,
    ctx: {
      item,
      weekStart: plan.week_start,
      business: {
        name: p.name,
        language: p.language || "en",
        description: p.description ?? "",
        tone: toneLine(p.tone),
        goals: rules.goals,
        // Services step: how long the business has been going, a fact ads may use
        yearsInBusiness: typeof p.onboarding?.yearsInBusiness === "number" ? p.onboarding.yearsInBusiness : null,
      },
      rules,
      ctaLinks: Object.fromEntries(Object.entries({ website: p.website, ...(p.cta_links ?? {}) }).filter(([, v]) => typeof v === "string" && v)) as Record<string, string>,
      // The client's list, plus the claims their industry may never make in ads
      avoidWords: [...new Set([...(p.compliance?.avoid_words ?? []), ...rules.industryNeverSay])],
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
        strategy: c.strategy ?? null,
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
            // A service's details: what's included, turnaround, how it works, where it's offered
            attributes: offering.data.attributes ?? {},
          }
        : null,
      // An offer the client hasn't confirmed is never used
      offer: offerRow && offerRow.verified !== false ? { id: offerRow.id, title: offerRow.title, details: offerRow.details, code: offerRow.code, endsAt: offerRow.ends_at } : null,
      proof: (proof.data ?? []).map((r) => ({ id: r.id, kind: r.kind, content: r.content, author: r.author, rating: r.rating })),
      assets: assetRows.map((a) => ({
        id: a.id,
        kind: a.kind,
        description: a.ai_description ?? (a.tags ?? []).join(", ") ?? null,
        offeringId: a.offering_id,
        offeringName: (a.offerings as unknown as { name: string } | null)?.name ?? null,
        storageKey: a.storage_key,
      })),
      passages,
      recentHooks: (hooks.data ?? []).map((h) => h.text),
      photoStyle: kit.data?.photo_style ?? null,
      layoutStyle: kit.data?.layout_style ?? null,
      designLanguage: kit.data?.design_language ?? null,
      moments,
      lessons,
      reference,
      tone: (p.tone ?? {}) as Record<string, number>,
      industry: p.industry ?? null,
      layouts: layoutsFor(
        item.style,
        ((kit.data?.template_ids ?? []) as string[]).filter((t): t is TemplateId => (TEMPLATE_IDS as readonly string[]).includes(t))
      ),
      recentDesigns,
      recentConcepts,
      logoTone: !rules.showLogo
        ? null
        : (() => {
            const v = (kit.data?.logo_variants ?? {}) as { full?: string; light?: string; dark?: string | null };
            const forLight = v.light ?? v.full ?? p.logo_key;
            return forLight && v.dark ? "both" : v.dark ? "light" : forLight ? "dark" : null;
          })(),
    },
  };
}
