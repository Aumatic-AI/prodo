import type { SupabaseClient } from "@supabase/supabase-js";
import type { Style } from "./schemas";
import { removeMissing, saveProgress, syncAssets, upsertRows } from "./sync";
import { ownRow } from "@/lib/supabase/own-row";

function competitorFields(link: string) {
  if (!link) return { website: null, social_urls: {} };
  if (/instagram\.com/i.test(link)) return { website: null, social_urls: { instagram: link } };
  if (/^@/.test(link)) return { website: null, social_urls: { instagram: `https://instagram.com/${link.slice(1)}` } };
  return { website: link, social_urls: {} };
}

export async function saveStyle(db: SupabaseClient, v: Style) {
  const [competitors, videos] = await Promise.all([
    // Competitors the agents found are managed in the Brand Hub, not here
    db.from("competitors").select("id").eq("source", "client"),
    db.from("brand_assets").select("id, storage_key").eq("kind", "reference_video"),
  ]);

  await upsertRows(
    db,
    "competitors",
    v.competitors.map((c) => ({ id: c.id, name: c.name, ...competitorFields(c.link) }))
  );
  await removeMissing(
    db,
    "competitors",
    (competitors.data ?? []).map((c) => c.id),
    v.competitors.map((c) => c.id),
    "delete"
  );

  await syncAssets(
    db,
    videos.data ?? [],
    v.competitorVideos.map((vid) => ({ id: vid.id, storage_key: vid.key, kind: "reference_video" }))
  );

  const { error } = await ownRow(db
    .from("app_settings")
    .update({
      autopilot_mode: v.autopilotMode,
      plan_weekday: v.planWeekday,
      plan_time: v.planTime,
      monthly_budget_usd: v.monthlyBudgetUsd,
    }));
  if (error) throw error;

  await saveProgress(
    db,
    "connect",
    {
      tone: v.tone,
      liked_brands: v.likedBrands,
      compliance: { avoid_words: v.avoidWords, forbidden_claims: [], disclaimers: v.disclaimers },
      posting_prefs: { platforms: v.postsPerWeek },
      voice_id: v.voiceId,
      music_mood: v.musicMood,
    },
    { voiceName: v.voiceName }
  );
}
