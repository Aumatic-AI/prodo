// Canvas sizes for every format, and the safe zone where text may go (platform UI covers the edges,
// most of all on 9:16 where the caption and buttons sit at the bottom and right).

export type CanvasRatio = "1:1" | "4:5" | "9:16" | "16:9";

export interface Canvas {
  ratio: CanvasRatio;
  width: number;
  height: number;
  /** Space to keep clear of text on each side, in px */
  safe: { top: number; right: number; bottom: number; left: number };
}

export const CANVAS: Record<CanvasRatio, Canvas> = {
  "1:1": { ratio: "1:1", width: 1080, height: 1080, safe: { top: 72, right: 72, bottom: 72, left: 72 } },
  "4:5": { ratio: "4:5", width: 1080, height: 1350, safe: { top: 80, right: 72, bottom: 96, left: 72 } },
  "9:16": { ratio: "9:16", width: 1080, height: 1920, safe: { top: 220, right: 140, bottom: 420, left: 72 } },
  "16:9": { ratio: "16:9", width: 1920, height: 1080, safe: { top: 72, right: 96, bottom: 72, left: 96 } },
};

/** Inner box text can use. */
export function safeBox(c: Canvas) {
  return { x: c.safe.left, y: c.safe.top, width: c.width - c.safe.left - c.safe.right, height: c.height - c.safe.top - c.safe.bottom };
}
