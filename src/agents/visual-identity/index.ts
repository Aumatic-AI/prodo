import { env } from "@/config/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { ai } from "@/providers/ai/registry";
import { urlFor } from "@/providers/storage/supabase-storage";
import { VISUAL_STYLE_SYSTEM, visualStylePrompt, visualStyleSchema } from "@/prompts/agents/visual-style";
import { optional } from "@/agents/run";
import { businessBrief } from "@/agents/research/context";
import { defineResearchAgent } from "@/agents/research/define";
import { collectCss, readDesign, type SiteDesign } from "./css";
import { analyzeLogo, downloadImage, makeLogoVariants, type LogoAnalysis, type LogoVariants } from "./logo";
import { pickColors } from "./palette";

// Agent 2 · Visual Identity Analyst
// Builds brand_kit so code can draw on-brand ads: colours with readable text pairs, fonts,
// logo versions for light and dark backgrounds, and a short description of the photo and layout style.
// homepage design (Firecrawl) + logo (code) → colours and pairs (code) → style (AI vision)

const MAX_PHOTOS = 4;

export const visualIdentityAnalyst = defineResearchAgent("visual_identity_analyst", async ({ ctx, task }) => {
  const db = () => createAdminClient();
  const publicUrl = (key: string) => urlFor(env.NEXT_PUBLIC_SUPABASE_URL, key);

  // A site that blocks reading isn't fatal: the logo alone still gives colours
  const site = ctx.website
    ? await optional(
        task(
          "read-homepage-design",
          async (track) => {
            const res = await ai.crawl.scrape(ctx.website!, { design: true });
            track(res.usage);
            const { css, fontLinks } = await collectCss(res.data.rawHtml ?? "", ctx.website!);
            return {
              design: readDesign(css, fontLinks),
              screenshotUrl: res.data.screenshotUrl ?? null,
            };
          },
          (r) =>
            `Read the homepage design: ${r.design.colors.length} colours, fonts ${[r.design.fonts.heading, r.design.fonts.body].filter(Boolean).join(" and ") || "not found"}`
        )
      )
    : null;

  const logo = ctx.logoKey
    ? await optional(
        task(
          "logo-colours-and-versions",
          async () => {
            const image = await downloadImage(publicUrl(ctx.logoKey!));
            const analysis = await analyzeLogo(image);
            const colors = pickColors(analysis.palette, site?.design.colors ?? []);
            const variants = await makeLogoVariants(db(), image, ctx.logoKey!, analysis, colors.text);
            return { analysis, variants };
          },
          (r: { analysis: LogoAnalysis; variants: LogoVariants }) =>
            `Took ${r.analysis.palette.length} colours from the logo${r.variants.dark ? " and made versions for light and dark backgrounds" : ""}`
        )
      )
    : null;

  const design: SiteDesign | undefined = site?.design;
  const kit = await task(
    "save-colours-and-fonts",
    async () => {
      const colors = pickColors(logo?.analysis.palette ?? [], design?.colors ?? []);
      const fonts = {
        heading: design?.fonts.heading ?? null,
        body: design?.fonts.body ?? null,
        found: design?.fonts.all ?? [],
      };
      const { error } = await db()
        .from("brand_kit")
        .update({
          colors,
          fonts,
          ...(logo ? { logo_variants: logo.variants } : {}),
        })
        .eq("id", 1);
      if (error) throw error;
      return {
        colors: [colors.primary, colors.secondary, colors.accent].filter(Boolean).length,
        pairs: colors.pairs.length,
      };
    },
    (r) => `Saved ${r.colors} brand colours and ${r.pairs} readable text and background pairs`
  );

  const images = [...(site?.screenshotUrl ? [site.screenshotUrl] : []), ...ctx.photoKeys.slice(0, MAX_PHOTOS).map(publicUrl)];
  let styled = false;
  if (images.length) {
    styled = !!(await optional(
      task(
        "describe-visual-style",
        async (track) => {
          const res = await ai.structured(
            visualStyleSchema,
            visualStylePrompt(businessBrief(ctx), !!site?.screenshotUrl, images.length - (site?.screenshotUrl ? 1 : 0)),
            {
              system: VISUAL_STYLE_SYSTEM,
              images,
            }
          );
          track(res.usage);
          const { error } = await db()
            .from("brand_kit")
            .update({
              photo_style: res.data.photoStyle,
              layout_style: res.data.layoutStyle,
            })
            .eq("id", 1);
          if (error) throw error;
          return res.data;
        },
        () => "Described the photo and layout style"
      )
    ));
  }

  if (!site && !logo) return "No website or logo to read, so the brand kit uses default colours";
  return `Saved ${kit.colors} brand colours, ${kit.pairs} readable colour pairs${design?.fonts.heading ? `, fonts ${design.fonts.heading} and ${design.fonts.body}` : ""}${styled ? " and the visual style" : ""}`;
});
