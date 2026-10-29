import type { SupabaseClient } from "@supabase/supabase-js";
import { CASE_TAG } from "./load";
import type { Services } from "./schemas";
import { rejectFound, removeMissing, saveProgress, syncAssets, upsertRows } from "./sync";

const CREDENTIAL_KINDS = ["certification", "award"];

export async function saveServices(db: SupabaseClient, v: Services) {
  const [offerings, cases, credentials, assets, profile] = await Promise.all([
    db.from("offerings").select("id, active").eq("kind", "service").or("active.eq.true,verified.eq.false"),
    db.from("proof_items").select("id").eq("kind", "case_study").eq("verified", true),
    db.from("proof_items").select("id").in("kind", CREDENTIAL_KINDS).eq("verified", true),
    db.from("brand_assets").select("id, storage_key").in("kind", ["team", "location", "work"]),
    db.from("business_profile").select("cta_links").single(),
  ]);
  const ids = (res: { data: { id: string }[] | null }) => (res.data ?? []).map((r) => r.id);
  const services = offerings.data ?? [];

  await upsertRows(
    db,
    "offerings",
    v.services.map((s, i) => ({
      id: s.id,
      kind: "service",
      name: s.name,
      price_model: s.priceModel,
      price: s.priceModel === "quote" ? null : s.price,
      currency: s.currency,
      url: s.url || null,
      priority: v.services.length - i,
      // FAQs belong to every service so agents can answer objections in any ad
      objections: v.faqs,
      attributes: { included: s.included, turnaround: s.turnaround, process: s.steps, area: v.area, areas: v.areas },
      // Saving a found service confirms it
      active: true,
      verified: true,
    }))
  );

  await upsertRows(
    db,
    "proof_items",
    [
      ...v.caseStudies.map((c) => ({ id: c.id, kind: "case_study", author: c.client, content: c.result, verified: true })),
      ...v.credentials.map((c) => ({ id: c.id, kind: c.kind, content: c.content, verified: true })),
    ]
  );

  // Case study photos are "work" photos tagged with their case study
  await syncAssets(db, assets.data ?? [], [
    ...v.caseStudies.flatMap((c) => c.photos.map((ph) => ({ id: ph.id, storage_key: ph.key, kind: "work", tags: [`${CASE_TAG}${c.id}`] }))),
    ...v.teamPhotos.map((ph) => ({ id: ph.id, storage_key: ph.key, kind: ph.kind, tags: [] })),
  ]);

  await Promise.all([
    removeMissing(db, "offerings", services.filter((r) => r.active).map((r) => r.id), v.services.map((s) => s.id), "archive"),
    rejectFound(db, "offerings", services.filter((r) => !r.active).map((r) => r.id), v.services.map((s) => s.id)),
    removeMissing(db, "proof_items", ids(cases), v.caseStudies.map((c) => c.id), "delete"),
    removeMissing(db, "proof_items", ids(credentials), v.credentials.map((c) => c.id), "delete"),
  ]);

  await saveProgress(
    db,
    "connect",
    { cta_links: { ...(profile.data?.cta_links ?? {}), lead_magnet: v.leadMagnetUrl || undefined } },
    { area: v.area, areas: v.areas, yearsInBusiness: v.yearsInBusiness, faqs: v.faqs }
  );
}
