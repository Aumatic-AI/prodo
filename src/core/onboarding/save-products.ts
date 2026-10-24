import type { SupabaseClient } from "@supabase/supabase-js";
import type { Products } from "./schemas";
import { removeMissing, saveProgress, syncAssets, upsertRows } from "./sync";

const REVIEW_KINDS = ["review", "testimonial"];

export async function saveProducts(db: SupabaseClient, v: Products) {
  const [offerings, offers, reviews, photos, dates] = await Promise.all([
    db.from("offerings").select("id").eq("kind", "product").eq("active", true),
    db.from("offers").select("id").eq("active", true),
    db.from("proof_items").select("id").in("kind", REVIEW_KINDS).eq("verified", true),
    db.from("brand_assets").select("id, storage_key").eq("kind", "product_photo"),
    db.from("calendar_events").select("id").eq("source", "client"),
  ]);
  const ids = (res: { data: { id: string }[] | null }) => (res.data ?? []).map((r) => r.id);

  // Products first: offers, reviews and photos point at them
  await upsertRows(
    db,
    "offerings",
    v.products.map((p, i) => ({
      id: p.id,
      kind: "product",
      name: p.name,
      price: p.price,
      currency: p.currency,
      url: p.url || null,
      is_hero: p.isHero,
      priority: v.products.length - i,
      benefits: p.benefits,
      audience: p.audience || null,
      objections: p.objections,
      active: true,
    }))
  );

  await syncAssets(
    db,
    photos.data ?? [],
    v.products.flatMap((p) => p.photos.map((ph) => ({ id: ph.id, storage_key: ph.key, kind: "product_photo", offering_id: p.id })))
  );

  await upsertRows(
    db,
    "offers",
    v.offers.map((o) => ({
      id: o.id,
      offering_id: o.offeringId,
      title: o.title,
      details: o.details || null,
      // The deal is live until the end of its last day
      ends_at: `${o.endsAt}T23:59:59Z`,
      active: true,
    }))
  );

  // A review's link is kept as its source; the source shares the review's id
  const linked = v.reviews.filter((r) => r.sourceUrl);
  await upsertRows(db, "brand_sources", linked.map((r) => ({ id: r.id, kind: "review", url: r.sourceUrl, title: "Added by the client" })));
  await upsertRows(
    db,
    "proof_items",
    v.reviews.map((r) => ({
      id: r.id,
      kind: "review",
      content: r.content,
      author: r.author || null,
      offering_id: r.offeringId,
      source_id: r.sourceUrl ? r.id : null,
      verified: true,
    }))
  );

  await upsertRows(
    db,
    "calendar_events",
    v.dates.map((d) => ({ id: d.id, name: d.name, date: d.date, kind: d.kind, source: "client", relevance: 4 }))
  );

  await Promise.all([
    removeMissing(db, "offerings", ids(offerings), v.products.map((p) => p.id), "archive"),
    removeMissing(db, "offers", ids(offers), v.offers.map((o) => o.id), "archive"),
    removeMissing(db, "proof_items", ids(reviews), v.reviews.map((r) => r.id), "delete"),
    removeMissing(db, "calendar_events", ids(dates), v.dates.map((d) => d.id), "delete"),
  ]);

  await saveProgress(db, "style");
}
