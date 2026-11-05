// Estimated vendor prices in USD, used for agent_runs.cost_usd and the budget cap.
// Check each vendor's pricing page and update these numbers.
export const PRICING = {
  openai: {
    // per 1M tokens
    "gpt-6.1-sol": { input: 2.0, output: 8.0 },
    "text-embedding-3-small": { input: 0.02, output: 0 },
  } as Record<string, { input: number; output: number }>,
  // OpenAI image model, per picture by quality (portrait size)
  openaiImage: { low: 0.02, medium: 0.07, high: 0.25, auto: 0.25 } as Record<string, number>,
  kie: {
    imagePerTask: 0.04,
    // GPT Image 2 on Kie, per picture by resolution
    gptImage: { "1K": 0.03, "2K": 0.05 } as Record<string, number>,
    videoPerSecond: 0.03,
    /** Seedance 2.5, per second of video, with text and images only (kie.ai/seedance-2-5) */
    seedance25PerSecond: { "480p": 0.14, "720p": 0.315, "1080p": 0.79 },
  },
  elevenlabs: {
    voicePer1kChars: 0.06,
    musicPerMinute: 0.5,
  },
  firecrawl: { perPage: 0.001 },
  // Freelance pack: $47 for 25,000 credits
  scrapecreators: { perCredit: 0.00188 },
  twelvelabs: {
    analyzePerCall: 0.05,
  },
} as const;

export function tokenCost(model: string, tokensIn: number, tokensOut: number): number {
  const price = PRICING.openai[model];
  if (!price) return 0;
  return (tokensIn * price.input + tokensOut * price.output) / 1_000_000;
}
