import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_GOALS, VIDEO_ONLY_PLATFORMS } from "./options";
import type { ContentPrefs } from "./load";
import type { Content } from "./schemas";
import { removeMissing, saveProgress, syncAssets, upsertRows } from "./sync";

/** A brand's link is a website, or an Instagram profile or handle. */
function brandFields(link: string) {
  if (!link) return { website: null, social_urls: {} };
  if (/instagram\.com/i.test(link)) return { website: null, social_urls: { instagram: link } };
  if (/^@/.test(link)) return { website: null, social_urls: { instagram: `https://instagram.com/${link.slice(1)}` } };
  return { website: link, social_urls: {} };
}

export async function saveContent(db: SupabaseClient, v: Content) {
  const [brands, assets, links] = await Promise.all([
    // Competitors the agents found are managed in the Brand Hub, not here
    db.from("competitors").select("id").eq("source", "client"),
    db.from("brand_assets").select("id, storage_key").in("kind", ["person", "general", "reference_image", "reference_video"]),
    db.from("brand_sources").select("id, url").eq("kind", "reference").not("url", "is", null),
  ]);
  const failed = [brands, assets, links].find((r) => r.error);
  if (failed?.error) throw failed.error;

  await upsertRows(
    db,
    "competitors",
    v.brands.map((b) => ({ id: b.id, name: b.name, relation: b.relation, source: "client", ...brandFields(b.link) }))
  );
  await removeMissing(db, "competitors", (brands.data ?? []).map((c) => c.id), v.brands.map((b) => b.id), "delete");

  await syncAssets(db, assets.data ?? [], [
    ...v.peoplePhotos.map((p) => ({ id: p.id, storage_key: p.key, kind: "person" })),
    ...v.ownMedia.map((m) => ({ id: m.id, storage_key: m.key, kind: "general" })),
    ...v.references.map((m) => ({ id: m.id, storage_key: m.key, kind: m.video ? "reference_video" : "reference_image" })),
  ]);

  // Pasted links wait as sources; the research reads them later
  const known = new Map((links.data ?? []).map((l) => [l.url, l.id]));
  const fresh = v.referenceLinks.filter((url) => !known.has(url));
  if (fresh.length) {
    const { error } = await db.from("brand_sources").insert(fresh.map((url) => ({ kind: "reference", url, title: "Reference added by the client" })));
    if (error) throw error;
  }
  const keep = new Set(v.referenceLinks);
  const gone = (links.data ?? []).filter((l) => !keep.has(l.url)).map((l) => l.id);
  if (gone.length) {
    const { error } = await db.from("brand_sources").delete().in("id", gone);
    if (error) throw error;
  }

  // Video-only platforms get no posts when the client wants images only
  const platforms = Object.fromEntries(
    Object.entries(v.postsPerWeek).map(([p, n]) => [p, v.mix === "images" && (VIDEO_ONLY_PLATFORMS as readonly string[]).includes(p) ? 0 : n])
  );

  const prefs: ContentPrefs = {
    goals: v.goals.slice(0, MAX_GOALS),
    mix: v.mix,
    // Images only: no video styles to keep
    image_styles: v.imageStyles,
    video_styles: v.mix === "images" ? [] : v.videoStyles,
    people: v.people,
    logo: v.logo,
  };

  await saveProgress(
    db,
    "basics",
    {
      content_prefs: prefs,
      // The first goal is the main one; older code reads this column
      primary_goal: v.goals[0],
      posting_prefs: { platforms },
      voice_id: v.voiceId,
      music_mood: v.musicMood,
    },
    { voiceName: v.voiceName }
  );
}
