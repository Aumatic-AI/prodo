import { env } from "@/config/env";

// Model per task. Change a model here, not in the adapters.
export const MODELS = {
  text: "gpt-6.1-sol",
  vision: "gpt-6.1-sol",
  /** Pulling facts out of website pages (many calls; a cheaper model is fine) */
  extract: "gpt-6.1-sol",
  /** Judgement over research: competitors, hooks, the weekly plan */
  analyze: "gpt-6.1-sol",
  /** Creative Director: briefs, hooks, scripts and captions */
  creative: "gpt-6.1-sol",
  /** QA Critic: scoring briefs and finished assets */
  critic: "gpt-6.1-sol",
  embed: env.EMBEDDING_MODEL,
  image: "nano-banana-2",
  video: "bytedance/seedance-2-mini",
  voice: "eleven_flash_v2_5",
  music: "music_v1",
  analyzeVideo: "pegasus1.5",
} as const;
