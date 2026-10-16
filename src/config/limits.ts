export const LIMITS = {
  logoMaxBytes: 2 * 1024 * 1024,
  imageMaxBytes: 10 * 1024 * 1024,
  videoMaxBytes: 100 * 1024 * 1024,
  aboutMaxChars: 1500,
  captionMaxChars: 63206,
  fetchTimeoutMs: 60_000,
  downloadTimeoutMs: 5 * 60_000,
} as const;
