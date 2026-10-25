import { platformMeta } from "@/config/platforms";
import type { Format } from "@/core/creative/brief";
import { CANVAS, type Canvas, type CanvasRatio } from "@/creative/sizes";

// Which sizes to make for a slot. The first is the main file (media.storage_key); the rest are
// saved as renditions so each platform gets the size it shows best.

const FEED_VIDEO = ["facebook", "linkedin", "twitter"];

export function canvasesFor(format: Format, platforms: string[]): Canvas[] {
  if (format === "carousel") return [CANVAS["4:5"]];
  if (format === "video") {
    const sizes: CanvasRatio[] = ["9:16"];
    if (platforms.some((p) => FEED_VIDEO.includes(p))) sizes.push("4:5");
    return sizes.map((r) => CANVAS[r]);
  }
  // Static: each platform's preferred size, main = the first platform's
  const ratios = [...new Set(platforms.map((p) => platformMeta(p).aspectRatios[0]))];
  return (ratios.length ? ratios : ["4:5" as const]).map((r) => CANVAS[r]);
}

/** Kie has no 4:5; ask for the closest portrait and let the layout crop. */
export function kieRatio(ratio: CanvasRatio): "1:1" | "2:3" | "9:16" | "16:9" {
  return ratio === "4:5" ? "2:3" : ratio;
}
