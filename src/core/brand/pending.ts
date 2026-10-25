import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { confirmInDraftOfferStack, dropFromDraftOfferStack } from "./bible";

// Facts the Website Analyst found that wait for the client: offerings and offers with
// active = false, verified = false; proof with verified = false.
// Confirm: offerings/offers become active and verified; proof becomes verified.
// Reject: offerings/offers stay archived but count as reviewed (verified = true); proof is deleted.

export const PENDING_KINDS = ["offering", "offer", "proof"] as const;
export type PendingKind = (typeof PENDING_KINDS)[number];

export interface PendingFact {
  kind: PendingKind;
  id: string;
  title: string;
  detail: string | null;
  sourceUrl: string | null;
}

export async function listPending(db: SupabaseClient): Promise<PendingFact[]> {
  const [offerings, offers, proof] = await Promise.all([
    db.from("offerings").select("id, kind, name, description, price, currency, brand_sources(url)").eq("verified", false).order("created_at"),
    db.from("offers").select("id, title, details, ends_at, brand_sources(url)").eq("verified", false).order("created_at"),
    db.from("proof_items").select("id, kind, content, author, rating, brand_sources(url)").eq("verified", false).order("created_at"),
  ]);
  const failed = [offerings, offers, proof].find((r) => r.error);
  if (failed?.error) throw failed.error;

  const url = (row: { brand_sources: unknown }) => (row.brand_sources as { url: string | null } | null)?.url ?? null;
  return [
    ...(offerings.data ?? []).map((o) => ({
      kind: "offering" as const,
      id: o.id,
      title: o.name,
      detail: [o.kind === "service" ? "Service" : "Product", o.price != null ? `${o.price} ${o.currency ?? ""}`.trim() : null, o.description].filter(Boolean).join(" · "),
      sourceUrl: url(o),
    })),
    ...(offers.data ?? []).map((o) => ({
      kind: "offer" as const,
      id: o.id,
      title: o.title,
      detail: [o.details, o.ends_at ? `Ends ${o.ends_at.slice(0, 10)}` : null].filter(Boolean).join(" · ") || null,
      sourceUrl: url(o),
    })),
    ...(proof.data ?? []).map((p) => ({
      kind: "proof" as const,
      id: p.id,
      title: p.content,
      detail: [p.kind.replace("_", " "), p.author, p.rating != null ? `${p.rating}★` : null].filter(Boolean).join(" · "),
      sourceUrl: url(p),
    })),
  ];
}

export async function decidePending(db: SupabaseClient, kind: PendingKind, id: string, accept: boolean): Promise<void> {
  if (kind === "proof") {
    const query = accept ? db.from("proof_items").update({ verified: true }) : db.from("proof_items").delete();
    const { error } = await query.eq("id", id).eq("verified", false);
    if (error) throw error;
    return;
  }

  const table = kind === "offering" ? "offerings" : "offers";
  const { data, error } = await db
    .from(table)
    .update(accept ? { active: true, verified: true } : { verified: true })
    .eq("id", id)
    .eq("verified", false)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new AppError("This item was already reviewed.", "INVALID_INPUT", false);

  if (kind === "offering") {
    await (accept ? confirmInDraftOfferStack(db, id) : dropFromDraftOfferStack(db, id));
  }
}
