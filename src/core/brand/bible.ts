import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError } from "@/core/errors";
import { ownRow } from "@/lib/supabase/own-row";

// The Brand Bible: one versioned document every content agent reads. Only one version is
// approved at a time; editing or regenerating makes a new draft and the approved one stays
// in use until the client approves the draft.

/**
 * Where a claim comes from: "chunk:<id>" (a Brand Brain passage), "answer:<key>" (the client's
 * onboarding answer), "offering:<id>", "proof:<id>" or "kit" (the brand kit). Claims without one are dropped.
 */
export type SourceRef = string;

const claimSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  sources: z.array(z.string()).max(12),
});
export type Claim = z.infer<typeof claimSchema>;

const personaSchema = z.object({
  name: z.string().trim().min(1).max(80),
  summary: z.string().trim().max(600),
  pains: z.array(z.string().trim().min(1).max(200)).max(8),
  desires: z.array(z.string().trim().min(1).max(200)).max(8),
  objections: z.array(z.string().trim().min(1).max(200)).max(8),
  triggers: z.array(z.string().trim().min(1).max(200)).max(8),
  phrases: z.array(z.string().trim().min(1).max(200)).max(8),
  sources: z.array(z.string()).max(12),
});
export type BiblePersona = z.infer<typeof personaSchema>;

export const FUNNEL_STAGES = ["tofu", "mofu", "bofu"] as const;
const pillarSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400),
  /** 0–1; all pillars add up to 1 */
  share: z.number().min(0).max(1),
  funnelStage: z.enum(FUNNEL_STAGES).nullable(),
  examples: z.array(z.string().trim().min(1).max(200)).max(6),
});
export type BiblePillar = z.infer<typeof pillarSchema>;

export const OFFER_ROLES = ["hero", "core", "entry", "upsell"] as const;
const offerStackSchema = z.object({
  offeringId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(200),
  role: z.enum(OFFER_ROLES),
  pitch: claimSchema,
  /** Found on the website and not confirmed by the client yet */
  pending: z.boolean(),
});
export type OfferStackItem = z.infer<typeof offerStackSchema>;

/** The whole Bible. Also the schema for saving an edited version. */
export const bibleContentSchema = z.object({
  positioning: claimSchema,
  value_prop: claimSchema,
  tone_guide: z.object({ summary: claimSchema, traits: z.array(claimSchema).max(8), examples: z.array(z.string().trim().min(1).max(300)).max(6) }),
  visual_rules: z.array(claimSchema).max(10),
  offer_stack: z.array(offerStackSchema).max(30),
  do_dont: z.object({ do: z.array(claimSchema).max(12), dont: z.array(claimSchema).max(12) }),
  never_say: z.array(z.string().trim().min(1).max(100)).max(80),
  personas: z.array(personaSchema).min(1).max(4),
  pillars: z.array(pillarSchema).min(1).max(5),
  /** The client's note when they asked for a regenerate */
  note: z.string().max(1000).nullish(),
});
export type BibleContent = z.infer<typeof bibleContentSchema>;

export type BibleStatus = "draft" | "approved" | "superseded";

export interface BibleVersion {
  id: string;
  version: number;
  status: BibleStatus;
  content: BibleContent;
  approved_at: string | null;
  created_at: string;
}

export type BibleVersionSummary = Omit<BibleVersion, "content">;

export async function listVersions(db: SupabaseClient): Promise<BibleVersionSummary[]> {
  const { data, error } = await db.from("brand_bible").select("id, version, status, approved_at, created_at").order("version", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getVersion(db: SupabaseClient, id: string): Promise<BibleVersion> {
  const { data, error } = await db.from("brand_bible").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError("This Brand Bible version doesn't exist.", "INVALID_INPUT", false);
  return data;
}

/** The approved version and the newest draft, either of which may not exist yet. */
export async function getCurrent(db: SupabaseClient): Promise<{ approved: BibleVersion | null; draft: BibleVersion | null }> {
  const [approved, draft] = await Promise.all([
    db.from("brand_bible").select("*").eq("status", "approved").maybeSingle(),
    db.from("brand_bible").select("*").eq("status", "draft").order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (approved.error) throw approved.error;
  if (draft.error) throw draft.error;
  return { approved: approved.data, draft: draft.data };
}

/** Saves content as the next version (a draft). Older drafts become superseded, so there is one draft at a time. */
export async function saveDraft(db: SupabaseClient, content: BibleContent): Promise<BibleVersion> {
  const { data: last, error: readError } = await db.from("brand_bible").select("version").order("version", { ascending: false }).limit(1).maybeSingle();
  if (readError) throw readError;

  const { error: oldError } = await db.from("brand_bible").update({ status: "superseded" }).eq("status", "draft");
  if (oldError) throw oldError;

  const { data, error } = await db
    .from("brand_bible")
    .insert({ version: (last?.version ?? 0) + 1, status: "draft", content })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Approves a draft: the previous approved version is superseded, the Bible's personas and
 * pillars replace the active ones (old ones archived), and onboarding is finished.
 */
export async function approveVersion(db: SupabaseClient, id: string): Promise<BibleVersion> {
  const version = await getVersion(db, id);
  if (version.status !== "draft") throw new AppError("Only a draft can be approved.", "INVALID_INPUT", false);

  // One approved version at a time (a unique index enforces it), so supersede first
  const { error: oldError } = await db.from("brand_bible").update({ status: "superseded" }).eq("status", "approved");
  if (oldError) throw oldError;
  const { data, error } = await db
    .from("brand_bible")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  await replaceActive(db, "personas", version.content.personas.map((p) => ({
    name: p.name,
    summary: p.summary,
    pains: p.pains,
    desires: p.desires,
    objections: p.objections,
    triggers: p.triggers,
    phrases: p.phrases,
  })));
  await replaceActive(db, "content_pillars", version.content.pillars.map((p) => ({
    name: p.name,
    description: p.description,
    target_share: Math.round(p.share * 1000) / 1000,
    funnel_stage: p.funnelStage,
  })));

  const { error: statusError } = await ownRow(db.from("business_profile").update({ onboarding_status: "done" }));
  if (statusError) throw statusError;
  return data;
}

/** Archives the active rows of a brand table and inserts the new ones (plans keep pointing at the old ids). */
async function replaceActive(db: SupabaseClient, table: "personas" | "content_pillars", rows: Record<string, unknown>[]) {
  const { error: archiveError } = await db.from(table).update({ active: false }).eq("active", true);
  if (archiveError) throw archiveError;
  if (!rows.length) return;
  const { error } = await db.from(table).insert(rows.map((r) => ({ ...r, active: true })));
  if (error) throw error;
}

/** Removes an offering from the draft's offer stack (after the client rejects it). */
export async function dropFromDraftOfferStack(db: SupabaseClient, offeringId: string): Promise<void> {
  const { draft } = await getCurrent(db);
  if (!draft) return;
  const offerStack = draft.content.offer_stack.filter((o) => o.offeringId !== offeringId);
  if (offerStack.length === draft.content.offer_stack.length) return;
  const { error } = await db
    .from("brand_bible")
    .update({ content: { ...draft.content, offer_stack: offerStack } })
    .eq("id", draft.id);
  if (error) throw error;
}

/** Marks an offering in the draft as confirmed. */
export async function confirmInDraftOfferStack(db: SupabaseClient, offeringId: string): Promise<void> {
  const { draft } = await getCurrent(db);
  if (!draft || !draft.content.offer_stack.some((o) => o.offeringId === offeringId)) return;
  const offerStack = draft.content.offer_stack.map((o) => (o.offeringId === offeringId ? { ...o, pending: false } : o));
  const { error } = await db
    .from("brand_bible")
    .update({ content: { ...draft.content, offer_stack: offerStack } })
    .eq("id", draft.id);
  if (error) throw error;
}
