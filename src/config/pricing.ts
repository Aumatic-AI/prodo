// Estimated vendor prices in USD, used for agent_runs.cost_usd and the budget cap.
// Check each vendor's pricing page and update these numbers.
export const PRICING = {
  openai: {
    // per 1M tokens
    "gpt-6.1-sol": { input: 2.0, output: 8.0 },
    "text-embedding-3-small": { input: 0.02, output: 0 },
  } as Record<string, { input: number; output: number }>,
  kie: {
    imagePerTask: 0.04,
    videoPerSecond: 0.03,
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
