import type { Canvas } from "./sizes";

// Burned-in captions as an ASS subtitle file, built from the voice-over's word timings.
// Two or three words at a time, the spoken word highlighted, plus big on-screen lines at the top
// (the hook first). The FFmpeg worker draws it with libass using the brand font.

export interface TimedWord {
  word: string;
  /** Seconds from the start of the video */
  start: number;
  end: number;
}

export interface SubtitleOptions {
  canvas: Canvas;
  words: TimedWord[];
  /** Big text at the top: the hook in the first seconds, then each scene's on-screen line */
  overlays?: { text: string; start: number; end: number }[];
  font: string;
  /** Highlight for the spoken word and the hook box ("#rrggbb") */
  highlight: string;
  /** Text colour on the highlight box */
  highlightText: string;
}

/** "#rrggbb" → ASS "&H00BBGGRR" */
function assColor(hex: string, alpha = 0): string {
  const h = hex.replace("#", "");
  const a = alpha.toString(16).padStart(2, "0");
  return `&H${a}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase();
}

function time(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = (s % 60).toFixed(2).padStart(5, "0");
  return `${h}:${String(m).padStart(2, "0")}:${rest}`;
}

const clean = (text: string) => text.replace(/[{}\\]/g, "").replace(/\s+/g, " ").trim();

/** Words in groups of up to three, broken at sentence ends. */
export function groupWords(words: TimedWord[], size = 3): TimedWord[][] {
  const groups: TimedWord[][] = [];
  let current: TimedWord[] = [];
  for (const w of words) {
    current.push(w);
    const sentenceEnd = /[.!?…]$/.test(w.word);
    if (current.length >= size || sentenceEnd) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

export function buildAss(o: SubtitleOptions): string {
  const { canvas } = o;
  const portrait = canvas.height > canvas.width;
  const captionSize = Math.round(canvas.width * (portrait ? 0.072 : 0.058));
  const hookSize = Math.round(canvas.width * (portrait ? 0.082 : 0.066));
  // Keep captions above the platform's own buttons and caption on 9:16
  const marginV = canvas.ratio === "9:16" ? 560 : Math.round(canvas.height * 0.12);
  const hookMarginV = canvas.ratio === "9:16" ? 300 : Math.round(canvas.height * 0.08);
  const side = Math.round(canvas.width * 0.08);

  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${canvas.width}`,
    `PlayResY: ${canvas.height}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Caption,${o.font},${captionSize},${assColor("#ffffff")},${assColor("#ffffff")},${assColor("#000000")},${assColor("#000000", 0x80)},1,0,0,0,100,100,0,0,1,${Math.round(captionSize * 0.09)},2,2,${side},${side},${marginV},1`,
    `Style: Hook,${o.font},${hookSize},${assColor(o.highlightText)},${assColor(o.highlightText)},${assColor(o.highlight)},${assColor(o.highlight)},1,0,0,0,100,100,0,0,3,${Math.round(hookSize * 0.28)},0,8,${side},${side},${hookMarginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const events: string[] = [];
  for (const overlay of o.overlays ?? []) {
    if (!overlay.text.trim() || overlay.end <= overlay.start) continue;
    events.push(`Dialogue: 1,${time(overlay.start)},${time(overlay.end)},Hook,,0,0,0,,{\\fad(120,200)}${clean(overlay.text)}`);
  }

  const highlight = assColor(o.highlight);
  for (const group of groupWords(o.words)) {
    group.forEach((w, i) => {
      const end = i < group.length - 1 ? group[i + 1].start : w.end;
      if (end <= w.start) return;
      // Upper-case the words only: ASS override tags are case-sensitive
      const word = (g: TimedWord) => clean(g.word).toUpperCase();
      const text = group.map((g, j) => (j === i ? `{\\c${highlight}}${word(g)}{\\c&HFFFFFF&}` : word(g))).join(" ");
      events.push(`Dialogue: 0,${time(w.start)},${time(end + (i === group.length - 1 ? 0.12 : 0))},Caption,,0,0,0,,${text}`);
    });
  }

  return [...header, ...events].join("\n") + "\n";
}
