import type { Publisher } from "./types";
import { UploadPostPublisher } from "./upload-post";

const publishers: Record<string, () => Publisher> = {
  "upload-post": () => new UploadPostPublisher(),
};

export function publisherFor(provider: string): Publisher {
  const factory = publishers[provider];
  if (!factory) throw new Error(`Unknown publishing provider: ${provider}`);
  return factory();
}

export function defaultProvider(): string {
  return "upload-post";
}
