import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ai } from "@/providers/ai/registry";
import type { Usage } from "@/providers/usage";

// The Brand Brain: raw sources (brand_sources) split into embedded chunks (brand_chunks)
// that later agents search with match_brand_chunks().

export type SourceKind = "web_page" | "social_post" | "competitor" | "serp" | "review" | "upload";

export interface SourceInput {
  kind: SourceKind;
  url: string;
  title?: string;
  content: string;
  metadata?: Record<string, unknown>;
  competitorId?: string;
}

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Saves a source, matched by kind and URL. `changed` is false when the content is the same as
 * last time, so callers can skip chunking and extraction.
 */
export async function saveSource(db: SupabaseClient, input: SourceInput): Promise<{ id: string; changed: boolean }> {
  const hash = hashText(input.content);
  let query = db.from("brand_sources").select("id, content_hash").eq("kind", input.kind).eq("url", input.url);
  query = input.competitorId ? query.eq("competitor_id", input.competitorId) : query.is("competitor_id", null);
  const { data: existing, error: readError } = await query.limit(1).maybeSingle();
  if (readError) throw readError;

  const row = {
    kind: input.kind,
    url: input.url,
    title: input.title ?? null,
    content_md: input.content,
    content_hash: hash,
    metadata: input.metadata ?? {},
    competitor_id: input.competitorId ?? null,
    fetched_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await db.from("brand_sources").update(row).eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, changed: existing.content_hash !== hash };
  }
  const { data, error } = await db.from("brand_sources").insert(row).select("id").single();
  if (error) throw error;
  return { id: data.id, changed: true };
}

/** Splits text into chunks of about `size` words, overlapping by `overlap` words, keeping paragraphs whole when possible. */
export function chunkText(text: string, size = 500, overlap = 80): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (!current.length) return;
    chunks.push(current.join(" "));
    current = current.slice(-overlap);
  };

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/);
    // A paragraph that would overflow starts a new chunk (unless the chunk is still mostly overlap)
    if (current.length + words.length > size && current.length > overlap) flush();
    for (const word of words) {
      current.push(word);
      if (current.length >= size) flush();
    }
  }
  if (current.length > overlap || !chunks.length) chunks.push(current.join(" "));
  return chunks.filter((c) => c.trim().length > 0);
}

const EMBED_BATCH = 96;

/**
 * Replaces the chunks of the given sources: splits each source's text, embeds the chunks in batches
 * and saves them. `metadata` is added to every chunk (filters for match_brand_chunks).
 */
export async function embedSources(
  db: SupabaseClient,
  sourceIds: string[],
  metadataFor: (source: { id: string; kind: string; url: string | null }) => Record<string, unknown> = () => ({})
): Promise<{ chunks: number; usage: Usage[] }> {
  if (!sourceIds.length) return { chunks: 0, usage: [] };

  const { data: sources, error } = await db.from("brand_sources").select("id, kind, url, title, content_md").in("id", sourceIds);
  if (error) throw error;

  const rows = (sources ?? []).flatMap((s) =>
    chunkText(s.content_md ?? "").map((content) => ({
      source_id: s.id,
      content: s.title ? `${s.title}\n\n${content}` : content,
      metadata: { kind: s.kind, ...metadataFor(s) },
    }))
  );

  const usage: Usage[] = [];
  const embedded: ((typeof rows)[number] & { embedding: string })[] = [];
  for (let i = 0; i < rows.length; i += EMBED_BATCH) {
    const batch = rows.slice(i, i + EMBED_BATCH);
    const res = await ai.embed(batch.map((r) => r.content));
    usage.push(res.usage);
    batch.forEach((r, j) => embedded.push({ ...r, embedding: JSON.stringify(res.data[j]) }));
  }

  // Swap old chunks for new ones only after every embedding succeeded
  const { error: deleteError } = await db.from("brand_chunks").delete().in("source_id", sourceIds);
  if (deleteError) throw deleteError;
  for (let i = 0; i < embedded.length; i += 200) {
    const { error: insertError } = await db.from("brand_chunks").insert(embedded.slice(i, i + 200));
    if (insertError) throw insertError;
  }
  return { chunks: embedded.length, usage };
}
