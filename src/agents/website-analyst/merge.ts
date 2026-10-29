import type { SupabaseClient } from "@supabase/supabase-js";
import { LIMITS } from "@/config/limits";
import type { Usage } from "@/providers/usage";
import type { PageFacts } from "@/prompts/agents/website-facts";
import { nameKey, sameName } from "@/agents/research/text";
import { findRepeats, type FactLine } from "./consolidate";

// Adds facts found on the website next to what the client entered. Rules:
// - The client's own rows are never changed.
// - New rows wait for the client: active = false, verified = false, with the page as source_id.
// - Rows the client already confirmed or rejected are left alone; pending ones are refreshed.
// - Websites repeat things across pages, so repeats are removed before saving: same text or a
//   near-identical name in code, then one AI check for repeats by meaning.
// Running it again on the same pages adds nothing new.

export interface MergeCounts {
  offerings: number;
  offers: number;
  proof: number;
  /** Items left out because they repeated another item or what the client entered */
  repeats: number;
}

/** A new offering found on the site, with what the scan needs to fetch its photos. */
export interface FoundOffering {
  id: string;
  name: string;
  inStock: boolean | null;
  /** Absolute links to the offering's photos on its page */
  imageUrls: string[];
  /** Its own page, where the scan looks for photos when the text had none */
  url: string | null;
  /** The page it was found on */
  sourceId: string;
}

/** Sold-out finds kept (hidden) so the client can still add them */
const MAX_SOLD_OUT = 5;
const PROOF_LABEL: Record<string, string> = { case_study: "case study", stat: "number", review: "review", testimonial: "testimonial", award: "award", certification: "certification" };

function absoluteUrl(url: string | null, pageUrl: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, pageUrl).toString();
  } catch {
    return null;
  }
}

/** A deal ending today is still live until the end of the day. Past deals are skipped. */
function endOfDay(date: string | null): string | null | "past" {
  if (!date) return null;
  const end = new Date(`${date}T23:59:59Z`);
  if (Number.isNaN(end.getTime())) return null;
  return end.getTime() < Date.now() ? "past" : end.toISOString();
}

function mostCommon(values: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

type Page = { id: string; url: string; facts: PageFacts };
type Found<T> = T & { fid: string; page: Page };

const proofKey = (content: string) => nameKey(content).slice(0, 160);

export async function mergeFacts(
  db: SupabaseClient,
  sourceIds: string[]
): Promise<{ counts: MergeCounts; found: FoundOffering[]; usage: Usage | null }> {
  const [sourcesRes, offeringsRes, offersRes, proofRes] = await Promise.all([
    db.from("brand_sources").select("id, url, metadata").in("id", sourceIds),
    db.from("offerings").select("id, kind, name, description, active, verified, source_id"),
    db.from("offers").select("id, title, details, verified"),
    db.from("proof_items").select("kind, author, content"),
  ]);
  const failed = [sourcesRes, offeringsRes, offersRes, proofRes].find((r) => r.error);
  if (failed?.error) throw failed.error;

  const pages: Page[] = (sourcesRes.data ?? [])
    .filter((s) => s.metadata?.facts)
    .map((s) => ({ id: s.id, url: s.url, facts: s.metadata.facts as PageFacts }))
    // Best-ranked pages first, so their version of a name wins
    .sort((a, b) => sourceIds.indexOf(a.id) - sourceIds.indexOf(b.id));
  const existingOfferings = offeringsRes.data ?? [];
  let next = 0;
  const fid = () => `F${++next}`;

  // ---- 1. Collect, dropping same text or near-identical names (code) ----
  const offerings: Found<PageFacts["offerings"][number]>[] = [];
  const refreshed: Record<string, unknown>[] = [];
  for (const page of pages) {
    for (const o of page.facts.offerings) {
      if (!nameKey(o.name) || offerings.some((x) => sameName(x.name, o.name))) continue;
      const existing = existingOfferings.find((e) => sameName(e.name, o.name));
      // The client's own rows and rows they already decided on are left alone
      if (existing && !(existing.source_id && !existing.verified)) continue;
      if (existing) {
        refreshed.push({
          id: existing.id,
          description: o.description,
          url: absoluteUrl(o.url, page.url) ?? page.url,
          price: o.price,
          benefits: o.benefits,
          ...(o.inStock === null || o.inStock === undefined ? {} : { attributes: { in_stock: o.inStock } }),
        });
      }
      else offerings.push({ ...o, fid: fid(), page });
    }
  }

  const offers: Found<PageFacts["offers"][number]>[] = [];
  for (const page of pages) {
    for (const offer of page.facts.offers) {
      if (!nameKey(offer.title) || endOfDay(offer.endsAt) === "past") continue;
      if (offers.some((x) => sameName(x.title, offer.title)) || (offersRes.data ?? []).some((e) => sameName(e.title, offer.title))) continue;
      offers.push({ ...offer, fid: fid(), page });
    }
  }

  const knownProofKeys = new Set((proofRes.data ?? []).map((p) => proofKey(p.content)));
  const proof: Found<PageFacts["proof"][number]>[] = [];
  for (const page of pages) {
    for (const item of page.facts.proof) {
      const key = proofKey(item.content);
      if (!key || knownProofKeys.has(key)) continue;
      knownProofKeys.add(key);
      proof.push({ ...item, fid: fid(), page });
    }
  }

  // ---- 2. One AI check for repeats by meaning ----
  let k = 0;
  const known: FactLine[] = [
    ...existingOfferings.filter((o) => o.active || o.verified).map((o) => ({ id: `K${++k}`, kind: "offering" as const, label: o.kind, text: [o.name, o.description].filter(Boolean).join(" — ") })),
    ...(offersRes.data ?? []).map((o) => ({ id: `K${++k}`, kind: "offer" as const, label: "offer", text: [o.title, o.details].filter(Boolean).join(" — ") })),
    ...(proofRes.data ?? []).map((p) => ({ id: `K${++k}`, kind: "proof" as const, label: PROOF_LABEL[p.kind] ?? p.kind, text: [p.author, p.content].filter(Boolean).join(": ") })),
  ];
  const found: FactLine[] = [
    ...offerings.map((o) => ({ id: o.fid, kind: "offering" as const, label: o.kind, text: [o.name, o.description].filter(Boolean).join(" — "), page: o.page.url })),
    ...offers.map((o) => ({ id: o.fid, kind: "offer" as const, label: "offer", text: [o.title, o.details].filter(Boolean).join(" — "), page: o.page.url })),
    ...proof.map((p) => ({ id: p.fid, kind: "proof" as const, label: PROOF_LABEL[p.kind] ?? p.kind, text: [p.author, p.content].filter(Boolean).join(": "), page: p.page.url })),
  ];
  const { drop, usage } = await findRepeats(found, known);
  const kept = <T extends { fid: string }>(list: T[]) => list.filter((x) => !drop.has(x.fid));

  // ---- 3. Save ----
  // The main ones only: pages are in rank order, so the homepage's featured products come first.
  // In-stock items fill the places; a few sold-out ones are kept, hidden, for "Add them anyway".
  const candidates = kept(offerings);
  const newOfferings = [
    ...candidates.filter((o) => o.inStock !== false).slice(0, LIMITS.scanOfferingsMax),
    ...candidates.filter((o) => o.inStock === false).slice(0, MAX_SOLD_OUT),
  ];
  // Shops convert prices for each visitor's country, so pages read from different places can
  // disagree. A price in a currency other than the usual one is left out rather than shown wrong.
  const usual = mostCommon(newOfferings.filter((o) => o.price !== null).map((o) => o.currency));
  const priced = (o: (typeof newOfferings)[number]) => o.price !== null && (!usual || o.currency === usual);
  let insertedOfferings: { id: string; name: string }[] = [];
  if (newOfferings.length) {
    const { data, error } = await db
      .from("offerings")
      .insert(
        newOfferings.map((o) => ({
          kind: o.kind,
          name: o.name,
          description: o.description,
          url: absoluteUrl(o.url, o.page.url) ?? o.page.url,
          price: priced(o) ? o.price : null,
          currency: priced(o) ? o.currency : null,
          price_model: o.kind === "service" ? o.priceModel : null,
          benefits: o.benefits,
          // Sold out stays out of the wizard until the client adds it
          attributes: o.inStock === null || o.inStock === undefined ? {} : { in_stock: o.inStock },
          source_id: o.page.id,
          active: false,
          verified: false,
        }))
      )
      .select("id, name");
    if (error) throw error;
    insertedOfferings = data ?? [];
  }
  const foundOfferings: FoundOffering[] = insertedOfferings.flatMap((row) => {
    const o = newOfferings.find((x) => x.name === row.name);
    if (!o) return [];
    const imageUrls = [...new Set((o.imageUrls ?? []).map((u) => absoluteUrl(u, o.page.url)).filter((u): u is string => !!u && /^https?:/.test(u)))];
    return [{ id: row.id, name: row.name, inStock: o.inStock ?? null, imageUrls, url: absoluteUrl(o.url, o.page.url), sourceId: o.page.id }];
  });
  for (const { id, ...fields } of refreshed) {
    const { error } = await db
      .from("offerings")
      .update(fields)
      .eq("id", id as string);
    if (error) throw error;
  }

  // Offers and proof can point at any offering, old or new
  const allOfferings = [...existingOfferings, ...insertedOfferings];
  const offeringIdFor = (name: string | null) => (name ? (allOfferings.find((o) => sameName(o.name, name))?.id ?? null) : null);

  const newOffers = kept(offers);
  if (newOffers.length) {
    const { error } = await db.from("offers").insert(
      newOffers.map((o) => ({
        title: o.title,
        details: o.details,
        code: o.code,
        offering_id: offeringIdFor(o.offeringName),
        ends_at: endOfDay(o.endsAt),
        source_id: o.page.id,
        active: false,
        verified: false,
      }))
    );
    if (error) throw error;
  }

  const newProof = kept(proof);
  if (newProof.length) {
    const { error } = await db.from("proof_items").insert(
      newProof.map((p) => ({
        kind: p.kind,
        content: p.content,
        author: p.author,
        rating: p.rating,
        offering_id: offeringIdFor(p.offeringName),
        source_id: p.page.id,
        verified: false,
      }))
    );
    if (error) throw error;
  }

  return { counts: { offerings: newOfferings.length, offers: newOffers.length, proof: newProof.length, repeats: drop.size }, found: foundOfferings, usage };
}
