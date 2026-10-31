import { inngest } from "./client";
import { businessDb } from "@/lib/supabase/business";
import { agentStep } from "@/agents/run";
import { unwatchedVideos, watchVideo, type UnwatchedVideo } from "@/agents/footage/watch";
import type { FootageAnalysis } from "@/prompts/agents/footage";

// A video the client added in Brand → Assets is watched straight away (the research run watches the
// ones from onboarding), so the next ads can use its moments. Logged as the Visual Identity Analyst.

export const watchFootage = inngest.createFunction(
  // Uploads come in bursts: a few seconds' wait gathers them into one run
  { id: "watch-footage", retries: 2, concurrency: [{ limit: 1, key: "event.data.businessId" }], debounce: { key: "event.data.businessId", period: "20s" } },
  { event: "brand/footage-added" },
  async ({ event, step }) => {
    const { businessId } = event.data;
    const db = () => businessDb(businessId);
    const runId = `footage-${event.id ?? Date.now()}`;

    const work = await step.run("videos-to-watch", async () => {
      const { data: p } = await db().from("business_profile").select("name, description, website").single();
      const business = [p?.name && `Business: ${p.name}`, p?.website && `Website: ${p.website}`, p?.description && `About: ${p.description}`].filter(Boolean).join("\n");
      return { business, videos: await unwatchedVideos(db()) };
    });

    let watched = 0;
    for (const [i, video] of (work.videos as UnwatchedVideo[]).entries()) {
      const analysis = await agentStep<FootageAnalysis | null>(
        step,
        `watch-video-${i}`,
        {
          businessId,
          agent: "visual_identity_analyst",
          runId,
          summary: (a) => (a ? `Watched your new video: ${a.moments.length} usable moments` : "Couldn't read your new video"),
        },
        async (track) => {
          const res = await watchVideo(db(), video, work.business);
          if (res.usage) track(res.usage);
          return res.analysis;
        }
      );
      if (analysis) watched++;
    }
    return { watched };
  }
);
