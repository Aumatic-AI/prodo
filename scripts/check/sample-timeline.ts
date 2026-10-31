// A sample video Timeline with a real business's brand (colours, fonts, logo) and its own photos,
// built by the same code as the Producer. No paid calls: no voice, music or AI pictures; the
// caption timings are written by hand to show the captions. Used by scripts/check/video-timeline.ts
// (render on your own computer) and scripts/smoke/render-ad.ts (render on the video worker).
import type { Timeline } from "@video/timeline";
import { businessDb } from "@/lib/supabase/business";
import { loadTheme } from "@/creative/theme";
import { buildTimeline, type BuildScene } from "@/creative/video/timeline";
import { timelineTheme, videoCanvas } from "@/creative/video/parts";
import { sfxUrls } from "@/config/sfx";
import { publicUrl } from "@/providers/storage/paths";
import { smokeBusinessId } from "../smoke/_run";

/** The business to use: SMOKE_BUSINESS_ID, else the first that finished onboarding, else any. */
export async function sampleBusinessId(): Promise<string> {
  if (process.env.SMOKE_BUSINESS_ID) return process.env.SMOKE_BUSINESS_ID;
  const done = await smokeBusinessId().catch(() => null);
  if (done) return done;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { data } = await createAdminClient().from("businesses").select("id").limit(1).single();
  return data!.id as string;
}

export async function sampleTimeline(businessId: string, preset = "bold", ratio = "9:16"): Promise<Timeline> {
  const db = businessDb(businessId);

  const { data: photos } = await db.from("brand_assets").select("storage_key").eq("kind", "product_photo").limit(4);
  const urls = (photos ?? []).map((p) => publicUrl(p.storage_key));
  if (urls.length < 3) throw new Error("Need at least 3 product photos for this business");

  const still = (url: string) => ({ kind: "image" as const, url, motion: { fromScale: 1, toScale: 1, fromX: 0, toX: 0, fromY: 0, toY: 0 } });
  const words = (text: string, from = 0.1, per = 0.38) => text.split(" ").map((word, i) => ({ word, start: from + i * per, end: from + (i + 1) * per - 0.05 }));
  const scene = (over: Partial<BuildScene>): BuildScene => ({
    kind: "benefit",
    media: still(urls[0]),
    reveal: null,
    layout: { subject: { x: 0.2, y: 0.25, w: 0.6, h: 0.45 }, zone: null, light: null },
    voice: null,
    speech: null,
    seconds: 3,
    overlay: "",
    keywords: [],
    sticker: null,
    stat: null,
    review: null,
    price: null,
    offer: null,
    transition: "smooth",
    ...over,
  });
  // Captions without a sound file: same shape as a real voice's word timings
  const voiced = (text: string, keywords: string[]) => ({ voice: { url: "", durationSec: text.split(" ").length * 0.38 + 0.1, words: words(text) }, keywords, seconds: null });

  const theme = timelineTheme(await loadTheme(db));
  const timeline = buildTimeline({
    canvas: videoCanvas(ratio as "9:16"),
    preset: preset as "bold",
    theme,
    scenes: [
      scene({ kind: "hook", media: still(urls[0]), overlay: "Handmade pieces that turn heads", keywords: ["turn", "heads"], transition: "energetic" }),
      scene({ kind: "detail", media: still(urls[1]), ...voiced("Every stone is set by hand in our studio", ["hand"]), sticker: "✨", transition: "smooth" }),
      scene({ kind: "product", media: still(urls[2]), ...voiced("Made to be worn every single day", ["every"]), price: "€89", transition: "energetic" }),
      scene({ kind: "stat", media: still(urls[3] ?? urls[0]), ...voiced("Loved by more than two thousand customers", ["thousand"]), stat: { value: 2000, decimals: 0, prefix: "", suffix: "+", label: "happy customers" }, transition: "reveal" }),
      scene({ kind: "cta", media: still(urls[0]), seconds: 2.8 }),
    ],
    hook: "Handmade pieces that turn heads",
    cta: { label: "Shop the collection", line: "Handmade, made to last", link: "royalgypsy.com" },
    music: null,
    sfx: sfxUrls(),
    progressBar: true,
  });
  // Voice files don't exist here: drop them, keep the captions
  timeline.audio.voice = [];
  return timeline;
}
