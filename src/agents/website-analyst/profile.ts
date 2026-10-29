import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS } from "@/config/models";
import { ai } from "@/providers/ai/registry";
import type { Usage } from "@/providers/usage";
import { ownRow } from "@/lib/supabase/own-row";
import { PROFILE_FACTS_SYSTEM, profileFactsPrompt, profileFactsSchema, type ProfileFacts } from "@/prompts/agents/website-profile";

// The business's basics read from its main pages during the onboarding scan. Only empty fields
// are filled: what the client typed is never changed.

const MAX_PAGES = 5;
const PROFILE_PAGE = /\/(about|about-us|our-story|story|my-story|who-we-are|company|contact|contact-us|shipping|delivery|returns?|refunds?|policies)[\w-]*(\/|$)/i;

const pathOf = (url: string) => {
  try {
    return new URL(url).pathname.replace(/\/+$/, "");
  } catch {
    return "/";
  }
};

/** Home first, then about, contact and policy pages, from the pages the scan read. */
export async function readProfileFacts(db: SupabaseClient, sourceIds: string[]): Promise<{ facts: ProfileFacts; usage: Usage }> {
  const { data, error } = await db.from("brand_sources").select("id, url, title, content_md").in("id", sourceIds);
  if (error) throw error;
  const pages = (data ?? [])
    .map((p) => ({ ...p, path: pathOf(p.url) }))
    .filter((p) => p.path === "" || PROFILE_PAGE.test(`${p.path}/`))
    .sort((a, b) => (a.path === "" ? -1 : b.path === "" ? 1 : sourceIds.indexOf(a.id) - sourceIds.indexOf(b.id)))
    .slice(0, MAX_PAGES);
  const res = await ai.structured(
    profileFactsSchema,
    profileFactsPrompt(pages.map((p) => ({ url: p.url, title: p.title, markdown: p.content_md ?? "" }))),
    { system: PROFILE_FACTS_SYSTEM, model: MODELS.extract }
  );
  return { facts: res.data, usage: res.usage };
}

const empty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v as object).length);

/**
 * Saves the facts into the empty profile fields. Returns the Basics form fields it filled.
 * Language defaults to English, so it is only set while the client hasn't saved Basics yet.
 */
export async function fillProfile(db: SupabaseClient, f: ProfileFacts): Promise<string[]> {
  const { data: p, error } = await db.from("business_profile").select("*").single();
  if (error) throw error;
  const basicsSaved = !["website", "content", undefined].includes(p.onboarding?.step);
  const update: Record<string, unknown> = {};
  const filled: string[] = [];
  const set = (column: string, field: string, value: unknown, when = empty(p[column])) => {
    if (!when || empty(value)) return;
    update[column] = value;
    if (!filled.includes(field)) filled.push(field);
  };

  set("name", "name", f.name);
  // Basics needs at least 20 characters
  set("description", "description", f.description && f.description.length >= 20 ? f.description : null);
  set("business_type", "businessType", f.businessType);
  set("countries", "countries", f.countries);
  set("cities", "cities", f.cities);
  set("language", "language", f.language, !basicsSaved);
  set("currency", "currency", f.currency);
  set("industry", "industry", f.industry);
  if (f.tone && empty(p.tone)) set("tone", "tone", f.tone);

  const disclaimers: string[] = p.compliance?.disclaimers ?? [];
  if (!disclaimers.length && f.disclaimers.length) {
    update.compliance = { avoid_words: [], forbidden_claims: [], ...(p.compliance ?? {}), disclaimers: f.disclaimers };
    filled.push("disclaimers");
  }

  // Where customers go: links only where the client has none
  const links: Record<string, string> = p.cta_links ?? {};
  const found: Record<string, string | null> = { shop: f.shopUrl, whatsapp: f.whatsapp, booking: f.bookingUrl, phone: f.phone };
  const added = Object.fromEntries(Object.entries(found).filter(([k, v]) => v && !links[k]));
  if (Object.keys(added).length) update.cta_links = { ...links, ...added };
  if (!p.primary_cta) {
    const all = { ...links, ...added };
    const type = p.business_type ?? f.businessType;
    const cta = type !== "service" && all.shop ? "shop" : all.booking ? "book" : all.whatsapp ? "whatsapp" : all.phone ? "call" : all.shop ? "shop" : null;
    if (cta) {
      update.primary_cta = cta;
      filled.push("cta");
    }
  }

  if (Object.keys(update).length) {
    const { error: saveError } = await ownRow(db.from("business_profile").update(update));
    if (saveError) throw saveError;
  }
  return filled;
}
