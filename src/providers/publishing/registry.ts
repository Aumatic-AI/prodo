import type { Publisher } from "./types";
import { UploadPostPublisher } from "./upload-post";
import { ZernioPublisher } from "./zernio";

// Each post_target stores its provider, so old Upload-Post rows still resolve.
const publishers: Record<string, () => Publisher> = {
  zernio: () => new ZernioPublisher(),
  "upload-post": () => new UploadPostPublisher(),
};

export const DEFAULT_PROVIDER = "zernio";

export function publisherFor(provider: string = DEFAULT_PROVIDER): Publisher {
  const factory = publishers[provider];
  if (!factory) throw new Error(`Unknown publishing provider: ${provider}`);
  return factory();
}
