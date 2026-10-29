import type { SupabaseClient } from "@supabase/supabase-js";
import type { Products } from "./schemas";
import { rejectFound, removeMissing, saveProgress, syncAssets, upsertRows } from "./sync";

const REVIEW_KINDS = ["review", "testimonial"];

export async function saveProducts(db: SupabaseClient, v: Products) {
  const [offerings, offers, reviews, photos, dates] = await Promise.all([
    db.from("offerings").select("id, active").eq("kind", "product").or("active.eq.true,verified.eq.false"),
    db.from("offers").select("id, active").or("active.eq.true,verified.eq.false"),
    db.from("proof_items").select("id").in("kind", REVIEW_KINDS),
    db.from("brand_assets").select("id, storage_key").eq("kind", "product_photo"),
    db.from("calendar_events").select("id").eq("source", "client"),
  ]);
  const ids = (res: { data: { id: string }[] | null }) => (res.data ?? []).map((r) => r.id);
  // Kept rows and rows found on the website that are still waiting
  const kept = (res: { data: { id: string; active: boolean }[] | null }) => ids({ data: (res.data ?? []).filter((r) => r.active) });
  const found = (res: { data: { id: string; active: boolean }[] | null }) => ids({ data: (res.data ?? []).filter((r) => !r.active) });

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
      // Saving a found product confirms it
      active: true,
      verified: true,
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
      ends_at: o.endsAt ? `${o.endsAt}T23:59:59Z` : null,
      active: true,
      verified: true,
    }))
  );

  // A review's link is kept as its source; the source shares the review's id.
  // Reviews found on the website keep the page they came from.
  const linked = v.reviews.filter((r) => r.sourceUrl && !r.found);
  await upsertRows(db, "brand_sources", linked.map((r) => ({ id: r.id, kind: "review", url: r.sourceUrl, title: "Added by the client" })));
  await upsertRows(
    db,
    "proof_items",
    v.reviews
      .filter((r) => !r.found)
      .map((r) => ({ id: r.id, kind: "review", content: r.content, author: r.author || null, offering_id: r.offeringId, source_id: r.sourceUrl ? r.id : null, verified: true }))
  );
  // Found reviews keep their kind and the page they came from
  await Promise.all(
    v.reviews
      .filter((r) => r.found)
      .map(async (r) => {
        const { error } = await db.from("proof_items").update({ content: r.content, author: r.author || null, offering_id: r.offeringId, verified: true }).eq("id", r.id);
        if (error) throw error;
      })
  );

  await upsertRows(
    db,
    "calendar_events",
    v.dates.map((d) => ({ id: d.id, name: d.name, date: d.date, kind: d.kind, source: "client", relevance: 4 }))
  );

  await Promise.all([
    removeMissing(db, "offerings", kept(offerings), v.products.map((p) => p.id), "archive"),
    rejectFound(db, "offerings", found(offerings), v.products.map((p) => p.id)),
    removeMissing(db, "offers", kept(offers), v.offers.map((o) => o.id), "archive"),
    rejectFound(db, "offers", found(offers), v.offers.map((o) => o.id)),
    removeMissing(db, "proof_items", ids(reviews), v.reviews.map((r) => r.id), "delete"),
    removeMissing(db, "calendar_events", ids(dates), v.dates.map((d) => d.id), "delete"),
  ]);

  await saveProgress(db, "connect");
}
