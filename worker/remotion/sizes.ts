// The video sizes every template is registered in. The id suffix is what Prodo asks for,
// e.g. "check-9x16".

export const FPS = 30;

export const SIZES = {
  "9x16": { width: 1080, height: 1920 },
  "1x1": { width: 1080, height: 1080 },
  "4x5": { width: 1080, height: 1350 },
} as const;

export type SizeId = keyof typeof SIZES;
