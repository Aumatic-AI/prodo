import { closestFont } from "@/config/google-fonts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import { ai } from "@/providers/ai/registry";
import { urlFor } from "@/providers/storage/supabase-storage";
import { optional } from "@/agents/run";
import type { Task } from "@/agents/website-analyst/read-website";
import { ownRow } from "@/lib/supabase/own-row";
import { collectCss, readDesign, type SiteDesign } from "./css";
import { analyzeLogo, downloadImage, makeLogoVariants, type LogoAnalysis, type LogoVariants } from "./logo";
import { pickColors } from "./palette";

// Colours, fonts and logo versions from the homepage design and the logo. Code only, no AI.
// Used by the Visual Identity Analyst (research) and by the onboarding website scan.

export interface KitResult {
  /** Homepage screenshot, for the visual style description */
  screenshotUrl: string | null;
  hadSite: boolean;
  hadLogo: boolean;
  colors: number;
  pairs: number;
  /** False when the client set them by hand, so nothing was changed */
  colorsSaved: boolean;
  fontsSaved: boolean;
  heading: string | null;
  body: string | null;
}

export async function buildKit({
  businessId,
  db,
  website,
  logoKey,
  task,
}: {
  businessId: string;
  db: () => SupabaseClient;
  website: string | null;
  logoKey: string | null;
  task: Task;
}): Promise<KitResult> {
  const publicUrl = (key: string) => urlFor(env.NEXT_PUBLIC_SUPABASE_URL, key);

  // A site that blocks reading isn't fatal: the logo alone still gives colours
  const site = website
    ? await optional(
        task(
          "read-homepage-design",
          async (track) => {
            const res = await ai.crawl.scrape(website, { design: true });
            track(res.usage);
            const { css, fontLinks } = await collectCss(res.data.rawHtml ?? "", website);
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

  const logo = logoKey
    ? await optional(
        task(
          "logo-colours-and-versions",
          async () => {
            const image = await downloadImage(publicUrl(logoKey));
            const analysis = await analyzeLogo(image);
            const colors = pickColors(analysis.palette, site?.design.colors ?? []);
            const variants = await makeLogoVariants(db(), businessId, image, logoKey, analysis, colors.text);
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
      // Colours and fonts the client set by hand in Brand → Brand kit stay theirs
      const { data: current } = await db().from("brand_kit").select("colors, fonts").single();
      const colors = current?.colors?.manual ? current.colors : pickColors(logo?.analysis.palette ?? [], design?.colors ?? []);
      const fonts = current?.fonts?.manual
        ? current.fonts
        : {
            // Ads can only use Google Fonts: a paid site font becomes its closest free match
            heading: closestFont(design?.fonts.heading, "heading"),
            body: closestFont(design?.fonts.body, "body"),
            // Font names only (stylesheets also hold escaped quotes and file names)
            found: (design?.fonts.all ?? []).filter((f) => /^[a-z][a-z0-9 ]*$/i.test(f)),
          };
      const { error } = await ownRow(db()
        .from("brand_kit")
        .update({
          colors,
          fonts,
          ...(logo ? { logo_variants: logo.variants } : {}),
        }));
      if (error) throw error;
      return {
        colors: [colors.primary, colors.secondary, colors.accent].filter(Boolean).length,
        pairs: colors.pairs.length,
        colorsSaved: !current?.colors?.manual,
        fontsSaved: !current?.fonts?.manual && !!(fonts.heading || fonts.body),
      };
    },
    (r) => `Saved ${r.colors} brand colours and ${r.pairs} readable text and background pairs`
  );

  return {
    screenshotUrl: site?.screenshotUrl ?? null,
    hadSite: !!site,
    hadLogo: !!logo,
    ...kit,
    heading: design?.fonts.heading ?? null,
    body: design?.fonts.body ?? null,
  };
}
