import * as OpenAI from "./openai";
import * as Kie from "./kie";
import * as ElevenLabs from "./elevenlabs";
import * as Firecrawl from "@/providers/crawl/firecrawl";
import * as ScrapeCreators from "@/providers/social/scrapecreators";
import * as TwelveLabs from "@/providers/video-understanding/twelvelabs";

// One entry point per task. Jobs, routes and agents call `ai`, never a vendor file.
// Every paid call returns { data, usage } so agents can log cost.
export const ai = {
  text: OpenAI.text,
  vision: OpenAI.vision,
  structured: OpenAI.structured,
  embed: OpenAI.embed,

  image: {
    create: Kie.createImageTask,
    status: Kie.checkTaskStatus,
  },
  video: {
    create: Kie.createVideoTask,
    status: Kie.checkTaskStatus,
  },
  task: {
    error: Kie.taskError,
    resultUrl: Kie.resultUrlOrThrow,
  },

  voice: ElevenLabs.generateSpeech,
  voices: ElevenLabs.listVoices,
  music: ElevenLabs.generateMusic,
  languageCode: ElevenLabs.languageCode,

  analyzeVideo: TwelveLabs.analyze,

  crawl: {
    map: Firecrawl.map,
    scrape: Firecrawl.scrape,
    screenshot: Firecrawl.screenshot,
    start: Firecrawl.startCrawl,
    status: Firecrawl.crawlStatus,
  },

  search: {
    google: ScrapeCreators.googleSearch,
  },
  ads: {
    google: ScrapeCreators.googleAds,
    metaAdvertisers: ScrapeCreators.metaAdvertisers,
    meta: ScrapeCreators.metaAds,
  },
  social: {
    profile: ScrapeCreators.profile,
    posts: ScrapeCreators.posts,
  },
};

export type { KieAspectRatio, TaskStatus } from "./kie";
export type { Speech, Voice, VoiceFilters, VoicePage } from "./elevenlabs";
export type { AdCreative, SocialPost, SocialProfile, WebResult } from "@/providers/social/types";
