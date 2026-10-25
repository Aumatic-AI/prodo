// Picks a font size so text fits a box, by simulating word wrap with average glyph widths.
// Satori wraps the text itself; we only choose the size so it never overflows.

/** Average glyph width as a share of the font size. */
const WIDTH = { regular: 0.53, bold: 0.58, caps: 0.68 };

function lineCount(text: string, size: number, maxWidth: number, factor: number): number {
  const space = size * factor * 0.55;
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = word.length * size * factor;
    if (used === 0) used = w;
    else if (used + space + w <= maxWidth) used += space + w;
    else {
      lines++;
      used = w;
    }
  }
  return lines;
}

export interface FitOptions {
  maxWidth: number;
  maxHeight: number;
  max: number;
  min: number;
  maxLines?: number;
  lineHeight?: number;
  weight?: "regular" | "bold";
  uppercase?: boolean;
}

/** The biggest size (step 2px) that fits; `min` if nothing does. */
export function fitText(text: string, o: FitOptions): { size: number; lines: number } {
  const factor = o.uppercase ? WIDTH.caps : WIDTH[o.weight ?? "bold"];
  const lineHeight = o.lineHeight ?? 1.1;
  for (let size = o.max; size >= o.min; size -= 2) {
    const lines = lineCount(text, size, o.maxWidth, factor);
    if (lines * size * lineHeight <= o.maxHeight && lines <= (o.maxLines ?? 99)) return { size, lines };
  }
  return { size: o.min, lines: lineCount(text, o.min, o.maxWidth, factor) };
}
