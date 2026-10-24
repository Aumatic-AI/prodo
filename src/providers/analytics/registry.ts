import type { Analytics } from "./types";
import { ZernioAnalytics } from "./zernio";

const providers: Record<string, () => Analytics> = {
  zernio: () => new ZernioAnalytics(),
};

export function analyticsFor(provider = "zernio"): Analytics {
  const factory = providers[provider];
  if (!factory) throw new Error(`Unknown analytics provider: ${provider}`);
  return factory();
}
