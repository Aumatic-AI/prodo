import { ai } from "@/providers/ai/registry";
import { publicUrl } from "@/providers/storage/paths";
import { VISUAL_STYLE_SYSTEM, visualStylePrompt, visualStyleSchema } from "@/prompts/agents/visual-style";
import { optional } from "@/agents/run";
import { businessBrief } from "@/agents/research/context";
import { defineResearchAgent } from "@/agents/research/define";
import { ownRow } from "@/lib/supabase/own-row";
import { buildKit } from "./brand-kit";
import { readSiteDesign } from "./design";
import { describePhotos } from "./photos";
import { unwatchedVideos, watchVideo, type UnwatchedVideo } from "@/agents/footage/watch";
import { inGroups } from "@/agents/research/define";

// Agent 2 · Visual Identity Analyst
// Builds brand_kit so code can draw on-brand ads: colours with readable text pairs, fonts,
// logo versions for light and dark backgrounds, and a short description of the photo and layout style and of the
// website's design language (components, motifs, motion).
// homepage design (Firecrawl) + logo (code) → colours and pairs (code) → homepage and two key pages (Firecrawl:
// screenshots, and motion from the code) → style and design language (AI vision) → one line per photo (AI vision)
// → the client's own videos watched for usable moments (Twelve Labs, new videos only)
// When the onboarding scan already read the same website with the same logo, the kit is kept as it is.

const MAX_PHOTOS = 4;
const MAX_REFERENCES = 3;

export const visualIdentityAnalyst = defineResearchAgent("visual_identity_analyst", async ({ businessId, db, ctx, task, step, skipped }) => {

  // The scan made the kit from this website and logo: reading them again would only cost money.
  // Decided in a step, so a retry of a later step doesn't decide again on a kit that changed since.
  const fromScan = await step.run("kit-from-scan", async () => {
    const { data: current, error } = await db().from("brand_kit").select("colors, logo_variants").single();
    if (error) throw error;
    return ctx.scanned && !!current?.colors?.pairs?.length && (!ctx.logoKey || current?.logo_variants?.full === ctx.logoKey);
  });
  const kit = fromScan ? null : await buildKit({ businessId, db, website: ctx.website, logoKey: ctx.logoKey, task, skipped });

  // The website's design language, read every time (the scan only took its colours and fonts): screenshots of the
  // homepage and two key pages, and how the site moves from its code. A site that can't be read isn't fatal
  const site = ctx.website
    ? await optional(
        task(
          "read-site-design",
          async (track) => {
            const read = await readSiteDesign(ctx.website!);
            track(read.usage);
            return { screenshots: read.screenshots, motion: read.motion, pages: read.pages };
          },
          (r) => `Looked at ${r.screenshots.length} page${r.screenshots.length === 1 ? "" : "s"} of the website${r.motion ? " and read how it moves" : ""}`
        ),
        { failed: skipped.note("looking at the website's design"), anyError: true }
      )
    : null;

  const screenshots = site?.screenshots.length ? site.screenshots : kit?.screenshotUrl ? [kit.screenshotUrl] : [];
  const photos = ctx.photoKeys.slice(0, MAX_PHOTOS).map(publicUrl);
  const references = ctx.referenceImageKeys.slice(0, MAX_REFERENCES).map(publicUrl);
  const images = [...screenshots, ...photos, ...references];
  let styled = false;
  if (images.length) {
    styled = !!(await optional(
      task(
        "describe-visual-style",
        async (track) => {
          const res = await ai.structured(visualStyleSchema, visualStylePrompt(businessBrief(ctx), screenshots.length, photos.length, references.length, site?.motion ?? null), {
            system: VISUAL_STYLE_SYSTEM,
            images,
          });
          track(res.usage);
          const { error: saveError } = await ownRow(
            db()
              .from("brand_kit")
              .update({ photo_style: res.data.photoStyle, layout_style: res.data.layoutStyle, design_language: res.data.designLanguage || null })
          );
          if (saveError) throw saveError;
          return res.data;
        },
        (r) => `Described the photo and layout style${r.designLanguage ? " and the website's design language" : ""}${references.length ? `, with ${references.length} of your references` : ""}`
      ),
      { failed: skipped.note("describing the photo and layout style") }
    ));
  }

  const described = await optional(describePhotos({ db, ctx, task, step, skipped }), { failed: skipped.note("describing your photos") });

  // The client's own videos: picked in a step so a retry watches the same ones
  const videos = (await step.run("videos-to-watch", () => unwatchedVideos(db()))) as UnwatchedVideo[];
  const watched = (
    await inGroups(videos, 2, (video, i) =>
      optional(
        task(
          `watch-video-${i}`,
          async (track) => {
            const res = await watchVideo(db(), video, businessBrief(ctx));
            if (res.usage) track(res.usage);
            return res.analysis;
          },
          (a) => (a ? `Watched one of your videos: ${a.moments.length} usable moments${a.moments.some((m) => m.talking) ? ", with someone talking to camera" : ""}` : "Couldn't read one of your videos")
        ),
        // Watching videos is a bonus: no Twelve Labs credit mustn't stop the brand kit
        { failed: skipped.note("watching one of your videos"), anyError: true }
      )
    )
  ).filter(Boolean).length;

  const parts = [
    kit
      ? kit.hadSite || kit.hadLogo
        ? `Saved ${kit.colors} brand colours, ${kit.pairs} readable colour pairs${kit.heading ? `, fonts ${kit.heading} and ${kit.body}` : ""}`
        : "No website or logo to read, so the brand kit uses default colours"
      : "Kept the colours, fonts and logo from the website scan",
    styled && "described the visual style",
    described && `described ${described} photos`,
    watched && `watched ${watched} of your videos`,
  ].filter(Boolean);
  return parts.join(", ");
});
