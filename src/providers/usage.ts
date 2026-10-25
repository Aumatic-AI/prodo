/** What one vendor call used and cost. Agents add these up into agent_runs. */
export interface Usage {
  provider: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd: number;
}

export interface Result<T> {
  data: T;
  usage: Usage;
}

export function sumUsage(items: Usage[]): Omit<Usage, "provider"> {
  return items.reduce(
    (acc, u) => ({
      model: acc.model ?? u.model,
      tokensIn: (acc.tokensIn ?? 0) + (u.tokensIn ?? 0),
      tokensOut: (acc.tokensOut ?? 0) + (u.tokensOut ?? 0),
      costUsd: acc.costUsd + u.costUsd,
    }),
    { costUsd: 0 } as Omit<Usage, "provider">
  );
}
