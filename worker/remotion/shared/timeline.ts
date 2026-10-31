// The contract between Prodo and the Ad composition. Prodo builds a Timeline from the brief, the
// voice timings, the media it made and the picture analysis (src/creative/video/); the composition
// only draws it. Every time and position is decided by Prodo from data, never here.
// Data only, no imports: the app (Next.js) and the worker both compile this file.

export const FPS = 30;

/** Where text sits on screen */
export type Zone = "top" | "middle" | "bottom";

/** A box as fractions of the frame (0–1), e.g. where the product is */
export type Box = { x: number; y: number; w: number; h: number };

export type ColorPair = { bg: string; text: string };

export type FontFile = { family: string; url: string; weight: number };

export type Theme = {
  primary: ColorPair;
  accent: ColorPair;
  light: ColorPair;
  dark: ColorPair;
  /** Font families; their files are in `fonts` */
  heading: string;
  body: string;
  fonts: FontFile[];
  /** Logo versions as links; null when the business chose no logo on its posts */
  logo: { onLight: string | null; onDark: string | null } | null;
  businessName: string;
};

/** Camera move over a still: scale and offset (fraction of the frame) from start to end */
export type Motion = { fromScale: number; toScale: number; fromX: number; toX: number; fromY: number; toY: number };

export type SceneMedia =
  /** A clip: an AI clip or a moment of the client's own video. volume 0 = muted */
  | { kind: "video"; url: string; trimStartSec: number; trimEndSec: number; volume: number; playbackRate: number }
  /** A still with a camera move (Ken Burns) */
  | { kind: "image"; url: string; motion: Motion }
  /** A brand colour (cards, end card) */
  | { kind: "color"; color: string };

/** How the picture is treated behind big cards (stat, review, end card) */
export type Backdrop = "plain" | "dim" | "blur";

export type SceneKind =
  | "hook"
  | "problem"
  | "product"
  | "detail"
  | "benefit"
  | "step"
  | "stat"
  | "review"
  | "offer"
  | "before"
  | "after"
  | "reveal"
  | "process"
  | "talking"
  | "result"
  | "cta";

export type TimelineScene = {
  id: string;
  kind: SceneKind;
  /** Frames on the timeline, already net of transition overlaps */
  startFrame: number;
  durationFrames: number;
  media: SceneMedia;
  /** Before-and-after reveal: the "after" picture wiped in over `media` */
  reveal: { media: SceneMedia; atFrame: number; durationFrames: number } | null;
  backdrop: Backdrop;
  /** Where the subject is (null = unknown); text and stickers keep clear of it */
  subject: Box | null;
  /** 0–1: how strong the dark gradient behind text needs to be (from the picture's brightness) */
  scrim: number;
};

export type TransitionKind = "none" | "fade" | "slide" | "wipe" | "flip" | "clockWipe" | "iris" | "zoom";
export type Direction = "from-left" | "from-right" | "from-top" | "from-bottom";

export type Transition = {
  kind: TransitionKind;
  direction: Direction;
  durationFrames: number;
  /** A warm light flash over the cut (editorial and playful looks) */
  lightLeak: boolean;
};

export type CaptionWord = { text: string; startFrame: number; endFrame: number; emphasis: boolean };

/** A few words shown together; the spoken one is highlighted */
export type CaptionPage = { startFrame: number; endFrame: number; zone: Zone; words: CaptionWord[] };

type Timed = { startFrame: number; durationFrames: number };

export type Layer =
  /** Big kinetic line: the hook, or a scene's short on-screen line */
  | (Timed & { kind: "title"; words: { text: string; emphasis: boolean }[]; zone: Zone; size: "xl" | "l" | "m"; role: "hook" | "line" })
  /** An emoji that pops in beside the subject at the word it belongs to */
  | (Timed & { kind: "sticker"; emoji: string; x: number; y: number; size: number })
  /** A number that counts up (a stored fact) */
  | (Timed & { kind: "stat"; value: number; decimals: number; prefix: string; suffix: string; label: string; zone: Zone })
  /** A real customer review */
  | (Timed & { kind: "review"; text: string; author: string; rating: number | null; zone: Zone })
  /** The current price, beside the product */
  | (Timed & { kind: "price"; text: string; x: number; y: number })
  /** A live offer */
  | (Timed & { kind: "offer"; title: string; detail: string; zone: Zone })
  /** Step number for how-to videos */
  | (Timed & { kind: "step"; number: number; total: number; zone: Zone })
  /** Closing card: logo or name, the call to action and one line */
  | (Timed & { kind: "endCard"; cta: string; line: string; link: string });

export type Sound = { url: string; startFrame: number; volume: number };

export type Soundtrack = {
  /** Voice-over, one file per scene */
  voice: Sound[];
  music: {
    url: string;
    /** Volume with nobody speaking, and while the voice (or a talking clip) plays */
    volume: number;
    duckedVolume: number;
    /** Frame ranges where speech plays */
    speech: { from: number; to: number }[];
    fadeInFrames: number;
    fadeOutFrames: number;
  } | null;
  /** Sound effects on events (transitions, stickers, reveals, the call to action) */
  sfx: Sound[];
};

export type Timeline = {
  version: 1;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  /** The look (see presets.ts) */
  preset: string;
  theme: Theme;
  /** Pixels at each edge where platform buttons and captions sit: no text there */
  safe: { top: number; right: number; bottom: number; left: number };
  scenes: TimelineScene[];
  /** Between scene i and i + 1 */
  transitions: Transition[];
  captions: CaptionPage[];
  layers: Layer[];
  audio: Soundtrack;
  /** Small logo in a corner until the end card */
  logoBug: { corner: "top-left" | "top-right"; untilFrame: number } | null;
  /** Thin bar showing how much is left (explainers and how-tos) */
  progressBar: boolean;
};
