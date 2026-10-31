// The looks a video can have. Prodo picks one per business from its tone and industry
// (src/creative/video/preset.ts); everything here is a rule the timeline builder and the
// composition apply the same way every time. Data only, no imports (shared by app and worker).

import type { TransitionKind } from "./timeline.ts";

export type PresetId = "minimal" | "bold" | "editorial" | "playful" | "corporate";

/** What a scene change should feel like; the preset turns it into a transition */
export type TransitionIntent = "cut" | "smooth" | "energetic" | "reveal";

/** Sound effects by name; the app maps names to files (src/config/sfx.ts) */
export type SfxName = "whoosh" | "swish" | "pop" | "ding" | "click" | "shutter" | "rise";

export type Preset = {
  id: PresetId;
  label: string;
  /** Each intent → a transition and its length */
  transitions: Record<TransitionIntent, { kind: TransitionKind; frames: number }>;
  /** A warm light flash on reveal transitions */
  lightLeaks: boolean;
  captions: {
    /** Words per page (1–3), size as a share of the frame width, weight */
    wordsPerPage: number;
    size: number;
    weight: number;
    uppercase: boolean;
    /** How the spoken word stands out: a colour box behind it, its colour, or a bump in size */
    active: "box" | "color" | "scale";
    /** Text outline/shadow strength for reading over pictures (0–1) */
    stroke: number;
  };
  titles: {
    size: number;
    weight: number;
    uppercase: boolean;
    /** How lines arrive */
    enter: "pop" | "rise" | "slide" | "fade" | "type";
    /** Spring stiffness for pops and rises */
    stiffness: number;
    damping: number;
    /** Emphasised words: brand colour box, underline drawn in, or brand colour */
    emphasis: "box" | "underline" | "color";
  };
  /** Ken Burns: how much stills zoom over a scene */
  zoom: number;
  /** Film grain over everything (0 = none) */
  grain: number;
  /** Emoji stickers allowed at all */
  stickers: boolean;
  sfx: {
    transition: SfxName | null;
    text: SfxName | null;
    reveal: SfxName | null;
    cta: SfxName | null;
    /** Overall level, lowered further under the voice */
    volume: number;
  };
  music: { volume: number; ducked: number };
  logoBug: "top-left" | "top-right" | null;
  /** Corner radius of cards and buttons, as a share of the frame width */
  radius: number;
};

export const PRESETS: Record<PresetId, Preset> = {
  minimal: {
    id: "minimal",
    label: "Minimal",
    transitions: { cut: { kind: "none", frames: 0 }, smooth: { kind: "fade", frames: 12 }, energetic: { kind: "slide", frames: 10 }, reveal: { kind: "fade", frames: 16 } },
    lightLeaks: false,
    captions: { wordsPerPage: 3, size: 0.058, weight: 700, uppercase: false, active: "color", stroke: 0.5 },
    titles: { size: 0.085, weight: 700, uppercase: false, enter: "rise", stiffness: 120, damping: 200, emphasis: "color" },
    zoom: 0.08,
    grain: 0,
    stickers: false,
    sfx: { transition: "swish", text: null, reveal: "ding", cta: "click", volume: 0.35 },
    music: { volume: 0.5, ducked: 0.12 },
    logoBug: "top-left",
    radius: 0.02,
  },
  bold: {
    id: "bold",
    label: "Bold",
    transitions: { cut: { kind: "none", frames: 0 }, smooth: { kind: "slide", frames: 9 }, energetic: { kind: "wipe", frames: 8 }, reveal: { kind: "zoom", frames: 12 } },
    lightLeaks: false,
    captions: { wordsPerPage: 2, size: 0.078, weight: 900, uppercase: true, active: "box", stroke: 1 },
    titles: { size: 0.11, weight: 900, uppercase: true, enter: "pop", stiffness: 260, damping: 14, emphasis: "box" },
    zoom: 0.16,
    grain: 0,
    stickers: true,
    sfx: { transition: "whoosh", text: "pop", reveal: "ding", cta: "click", volume: 0.55 },
    music: { volume: 0.6, ducked: 0.15 },
    logoBug: "top-left",
    radius: 0.03,
  },
  editorial: {
    id: "editorial",
    label: "Editorial",
    transitions: { cut: { kind: "none", frames: 0 }, smooth: { kind: "fade", frames: 18 }, energetic: { kind: "slide", frames: 14 }, reveal: { kind: "iris", frames: 20 } },
    lightLeaks: true,
    captions: { wordsPerPage: 3, size: 0.054, weight: 600, uppercase: false, active: "color", stroke: 0.4 },
    titles: { size: 0.082, weight: 600, uppercase: false, enter: "fade", stiffness: 80, damping: 200, emphasis: "underline" },
    zoom: 0.1,
    grain: 0.05,
    stickers: false,
    sfx: { transition: "swish", text: null, reveal: "shutter", cta: null, volume: 0.3 },
    music: { volume: 0.6, ducked: 0.14 },
    logoBug: "top-right",
    radius: 0.012,
  },
  playful: {
    id: "playful",
    label: "Playful",
    transitions: { cut: { kind: "none", frames: 0 }, smooth: { kind: "slide", frames: 12 }, energetic: { kind: "clockWipe", frames: 14 }, reveal: { kind: "iris", frames: 16 } },
    lightLeaks: true,
    captions: { wordsPerPage: 2, size: 0.07, weight: 800, uppercase: false, active: "scale", stroke: 0.9 },
    titles: { size: 0.1, weight: 800, uppercase: false, enter: "pop", stiffness: 200, damping: 10, emphasis: "box" },
    zoom: 0.14,
    grain: 0,
    stickers: true,
    sfx: { transition: "whoosh", text: "pop", reveal: "ding", cta: "click", volume: 0.5 },
    music: { volume: 0.6, ducked: 0.15 },
    logoBug: "top-left",
    radius: 0.04,
  },
  corporate: {
    id: "corporate",
    label: "Corporate",
    transitions: { cut: { kind: "none", frames: 0 }, smooth: { kind: "slide", frames: 12 }, energetic: { kind: "wipe", frames: 10 }, reveal: { kind: "fade", frames: 14 } },
    lightLeaks: false,
    captions: { wordsPerPage: 3, size: 0.056, weight: 700, uppercase: false, active: "box", stroke: 0.5 },
    titles: { size: 0.08, weight: 800, uppercase: false, enter: "slide", stiffness: 140, damping: 200, emphasis: "color" },
    zoom: 0.07,
    grain: 0,
    stickers: false,
    sfx: { transition: "swish", text: null, reveal: "ding", cta: "click", volume: 0.3 },
    music: { volume: 0.45, ducked: 0.1 },
    logoBug: "top-left",
    radius: 0.016,
  },
};

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
