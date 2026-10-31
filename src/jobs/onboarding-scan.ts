import { inngest } from "./client";
import { businessDb } from "@/lib/supabase/business";
import { userMessage } from "@/core/errors";
import { readScan, setScanState } from "@/core/onboarding/scan";
import { agentStep, optional } from "@/agents/run";
import { businessBrief, loadResearchContext, type ResearchContext } from "@/agents/research/context";
import { inGroups } from "@/agents/research/define";
import { readWebsite, shortUrl, type Task } from "@/agents/website-analyst/read-website";
import { fillProfile, readProfileFacts } from "@/agents/website-analyst/profile";
import { fetchHtml, findLogoUrl, findProductImages, saveLogo, saveProductPhotos } from "@/agents/website-analyst/images";
import { buildKit } from "@/agents/visual-identity/brand-kit";
import { fillSocialsFromWebsite } from "@/agents/social-market/website-socials";
import { ownRow } from "@/lib/supabase/own-row";
import { LIMITS } from "@/config/limits";

// Onboarding website scan: reads the site from the first screen while the client answers
// "Your content", and fills Basics and the products or services with what it finds.
// read pages and facts → basics → socials → logo → colours and fonts → product photos


export const onboardingScan = inngest.createFunction(
  {
    id: "onboarding-scan",
    concurrency: [{ limit: 1, key: "event.data.businessId" }],
    retries: 2,
    // A new website on the first screen replaces a scan that is still running
    cancelOn: [{ event: "onboarding/scan", if: "async.data.businessId == event.data.businessId && async.data.scanId != event.data.scanId" }],
    onFailure: async ({ error, event }) => {
      const { businessId, scanId } = event.data.event.data;
      const db = businessDb(businessId);
      if ((await readScan(db))?.id !== scanId) return;
      await setScanState(db, "error", userMessage(error) || "We couldn't finish reading your website.");
      await setScanState(db, "finishedAt", new Date().toISOString());
      await setScanState(db, "state", "failed");
    },
  },
  { event: "onboarding/scan" },
  async ({ event, step }) => {
    const { businessId, scanId } = event.data;
    const db = () => businessDb(businessId);
    const task: Task = (id, fn, summary) => agentStep(step, id, { agent: "website_analyst", businessId, runId: scanId, summary }, fn);

    const start = (await step.run("load-context", async () => {
      const scan = await readScan(db());
      // A newer scan replaced this one
      if (!scan || scan.id !== scanId) return null;
      return { website: scan.website, ctx: await loadResearchContext(db()) };
    })) as { website: string; ctx: ResearchContext } | null;
    if (!start) return { status: "replaced" };
    const { website, ctx } = start;

    const site = await readWebsite({ db, website, brief: businessBrief(ctx), task });

    const basics = await optional(
      task(
        "read-business-basics",
        async (track) => {
          const res = await readProfileFacts(db(), site.pages);
          track(res.usage);
          return { filled: await fillProfile(db(), res.facts), logoUrl: res.facts.logoUrl };
        },
        (r) => (r.filled.length ? `Filled ${r.filled.length} answers in Basics from your website` : "Basics were already answered")
      )
    );

    const socials = await optional(
      task(
        "find-social-profiles",
        async () => {
          const { data, error } = await db().from("business_profile").select("social_urls").single();
          if (error) throw error;
          return Object.keys(await fillSocialsFromWebsite(db(), website, data.social_urls ?? {}));
        },
        (r) => (r.length ? `Found ${r.join(", ")} on your website` : "No new social profiles on your website")
      )
    );

    const logo = await optional(
      task(
        "find-logo",
        async () => {
          const { data, error } = await db().from("business_profile").select("logo_key").single();
          if (error) throw error;
          if (data.logo_key) return { key: data.logo_key as string, added: false };
          const html = await fetchHtml(website).catch(() => null);
          const url = (html && findLogoUrl(html, website)) || basics?.logoUrl;
          const key = url ? await saveLogo(businessId, url) : null;
          if (!key) return { key: null, added: false };
          // The client may have uploaded one meanwhile: theirs wins
          const { data: saved, error: saveError } = await ownRow(db().from("business_profile").update({ logo_key: key }))
            .is("logo_key", null)
            .select("logo_key");
          if (saveError) throw saveError;
          return { key, added: !!saved?.length };
        },
        (r) => (r.added ? "Took your logo from the website" : r.key ? "Kept the logo you uploaded" : "No logo found on the website")
      )
    );

    const kit = await optional(buildKit({ businessId, db, website, logoKey: logo?.key ?? null, task }));

    // Photos of new products that can be bought now; sold-out ones wait until the client adds them
    const products = site.found.filter((o) => o.inStock !== false && (o.imageUrls.length || o.url)).slice(0, LIMITS.scanOfferingsMax);
    await inGroups(products, 4, (product, i) =>
      optional(
        task(
          `product-photos-${i}`,
          async () => {
            const { count, error } = await db().from("brand_assets").select("id", { count: "exact", head: true }).eq("offering_id", product.id);
            if (error) throw error;
            if (count) return 0;
            // Page text has no image links, so the photos usually come from the product's own page
            const urls = product.imageUrls.length ? product.imageUrls : product.url ? await findProductImages(product.url) : [];
            const photos = await saveProductPhotos(businessId, urls, LIMITS.scanPhotosPerOffering);
            if (photos.length) {
              const { error: insertError } = await db()
                .from("brand_assets")
                .insert(photos.map(({ id, key }) => ({ id, kind: "product_photo", storage_key: key, offering_id: product.id, source_id: product.sourceId })));
              if (insertError) throw insertError;
            }
            return photos.length;
          },
          (n) => (n ? `Saved ${n} photos of ${product.name}` : `No usable photos of ${product.name}`)
        )
      )
    );

    return step.run("finish", async () => {
      if ((await readScan(db()))?.id !== scanId) return { status: "replaced" };
      const filled = [
        ...(basics?.filled ?? []),
        ...(socials?.length ? ["socials"] : []),
        ...(logo?.added ? ["logoKey"] : []),
        ...(kit?.colorsSaved && kit.colors ? ["colors"] : []),
        ...(kit?.fontsSaved ? ["fonts"] : []),
      ];
      await setScanState(db(), "filled", filled);
      await setScanState(db(), "soldOut", site.found.filter((o) => o.inStock === false).map((o) => o.name));
      await setScanState(db(), "finishedAt", new Date().toISOString());
      await setScanState(db(), "state", "done");
      return { status: "done", website: shortUrl(website), pages: site.pages.length, found: site.counts, filled };
    });
  }
);
