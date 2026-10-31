import { FPS, type Box, type CaptionPage, type CaptionWord, type Layer, type SceneKind, type SceneMedia, type Sound, type Theme, type Timeline, type TimelineScene, type Transition, type Zone } from "@video/timeline";
import { PRESETS, type PresetId, type SfxName, type TransitionIntent } from "@video/presets";
import type { Canvas } from "@/creative/sizes";

// Brief + made media → the exact Timeline the renderer draws (worker/remotion/shared/timeline.ts).
// Pure code, no AI: every time and place comes from data.
// - scene lengths: the voice's real length, a talking moment's length, or the brief's seconds
// - captions: the voice's word timings (or a talking moment's lines); key words from the brief stand out
// - text zones: the calm area the picture analysis found, away from the subject and platform buttons
// - stickers, prices and counters: at the moment their key word is said, beside the subject
// - transitions, sizes, motion and sound effects: from the preset

export interface BuildWord {
  word: string;
  /** Seconds from the start of this scene's voice */
  start: number;
  end: number;
}

export interface BuildScene {
  kind: SceneKind;
  media: SceneMedia;
  /** "reveal" scenes: the after picture */
  reveal: SceneMedia | null;
  /** From the picture analysis or the footage log */
  layout: { subject: Box | null; zone: Zone | null; light: boolean | null };
  /** Made voice-over for this scene */
  voice: { url: string; durationSec: number; words: BuildWord[] } | null;
  /** A talking moment's own words (seconds from the scene's start) */
  speech: { start: number; end: number; text: string }[] | null;
  /** Length when nothing is spoken (music-only scenes) or a talking moment's length */
  seconds: number | null;
  overlay: string;
  keywords: string[];
  /** Emoji character */
  sticker: string | null;
  stat: { value: number; decimals: number; prefix: string; suffix: string; label: string } | null;
  review: { text: string; author: string; rating: number | null } | null;
  price: string | null;
  offer: { title: string; detail: string } | null;
  transition: TransitionIntent;
}

export interface BuildInput {
  canvas: Canvas;
  preset: PresetId;
  theme: Theme;
  scenes: BuildScene[];
  /** The hook line, used when the first scene has no on-screen line */
  hook: string;
  cta: { label: string; line: string; link: string };
  music: { url: string } | null;
  /** Sound effect files by name */
  sfx: Partial<Record<SfxName, string>>;
  progressBar: boolean;
}

const f = (sec: number) => Math.round(sec * FPS);
/** A breath after each voiced scene */
const PAUSE_SEC = 0.35;
const MIN_SCENE_SEC = 1.6;
const CTA_HOLD_SEC = 2.4;
const STICKER_SEC = 1.6;

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}%$€£₪₹.]/gu, "").replace(/\.$/, "");

/** True when a spoken or written word is (part of) one of the key words. */
function isKey(word: string, keywords: string[]): boolean {
  const w = norm(word);
  if (!w) return false;
  return keywords.some((k) => k.split(/\s+/).some((part) => norm(part) === w));
}

/** Seconds of content in a scene, before transitions. */
function contentSeconds(s: BuildScene): number {
  if (s.voice) return Math.max(MIN_SCENE_SEC, s.voice.durationSec + PAUSE_SEC);
  const base = Math.max(MIN_SCENE_SEC, s.seconds ?? 3);
  return s.kind === "cta" ? Math.max(base, CTA_HOLD_SEC) : base;
}

/** Zones for the on-screen line and the captions of one scene, so they never sit on each other or on the subject. */
export function zonesFor(scene: BuildScene, hasTitle: boolean): { title: Zone; captions: Zone } {
  const subject = scene.layout.subject;
  // Where the subject isn't: its centre decides
  const cy = subject ? subject.y + subject.h / 2 : 0.5;
  const free: Zone = scene.layout.zone ?? (cy > 0.55 ? "top" : "bottom");
  if (!hasTitle) return { title: free, captions: free === "middle" ? "bottom" : free };
  if (free === "top") return { title: "top", captions: cy < 0.62 ? "bottom" : "middle" };
  if (free === "bottom") return { title: "bottom", captions: cy > 0.4 ? "top" : "middle" };
  return { title: "middle", captions: "bottom" };
}

/** Pages of 1–3 words: a new page after the preset's count, at a sentence end or a pause. */
function pages(words: CaptionWord[], perPage: number, zone: Zone): CaptionPage[] {
  const out: CaptionPage[] = [];
  let current: CaptionWord[] = [];
  const flush = () => {
    if (!current.length) return;
    out.push({ startFrame: current[0].startFrame, endFrame: current[current.length - 1].endFrame, zone, words: current });
    current = [];
  };
  words.forEach((w, i) => {
    current.push(w);
    const next = words[i + 1];
    const sentenceEnd = /[.!?…]$/.test(w.text);
    const pause = next ? next.startFrame - w.endFrame > f(0.3) : true;
    if (current.length >= perPage || sentenceEnd || pause) flush();
  });
  flush();
  // Each page stays until the next one starts (no flicker between pages)
  for (let i = 0; i < out.length - 1; i++) if (out[i + 1].startFrame - out[i].endFrame < f(0.4)) out[i].endFrame = out[i + 1].startFrame;
  return out;
}

/** Spread a talking moment's lines into words, evenly over each line's time. */
function speechWords(lines: { start: number; end: number; text: string }[]): BuildWord[] {
  return lines.flatMap((l) => {
    const words = l.text.split(/\s+/).filter(Boolean);
    const step = (l.end - l.start) / Math.max(1, words.length);
    return words.map((word, i) => ({ word, start: l.start + i * step, end: l.start + (i + 1) * step }));
  });
}

/** Ken Burns from the subject: push in towards it (hooks faster), stay centred without one. */
export function motionFor(kind: SceneKind, subject: Box | null, zoom: number): { fromScale: number; toScale: number; fromX: number; toX: number; fromY: number; toY: number } {
  const amount = kind === "hook" ? zoom * 1.3 : kind === "cta" || kind === "review" || kind === "stat" ? zoom * 0.5 : zoom;
  const cx = subject ? subject.x + subject.w / 2 : 0.5;
  const cy = subject ? subject.y + subject.h / 2 : 0.5;
  // Wide subjects: a slow pan along them instead of a push
  if (subject && subject.w > 0.7 && kind !== "hook") {
    return { fromScale: 1 + amount, toScale: 1 + amount, fromX: amount / 2, toX: -amount / 2, fromY: 0, toY: 0 };
  }
  return { fromScale: 1, toScale: 1 + amount, fromX: 0, toX: (0.5 - cx) * amount, fromY: 0, toY: (0.5 - cy) * amount };
}

/** A spot beside the subject (on the side with more room), inside the safe area. Fractions of the frame. */
export function besideSubject(subject: Box | null, canvas: Canvas, avoid: Zone): { x: number; y: number } {
  const safe = { left: canvas.safe.left / canvas.width, right: 1 - canvas.safe.right / canvas.width, top: canvas.safe.top / canvas.height, bottom: 1 - canvas.safe.bottom / canvas.height };
  const clampX = (x: number) => Math.min(safe.right - 0.12, Math.max(safe.left + 0.12, x));
  const clampY = (y: number) => Math.min(safe.bottom - 0.08, Math.max(safe.top + 0.08, y));
  if (!subject) return { x: clampX(0.76), y: clampY(avoid === "top" ? 0.62 : 0.3) };
  const rightRoom = 1 - (subject.x + subject.w);
  const x = rightRoom >= subject.x ? subject.x + subject.w + rightRoom / 2 : subject.x / 2;
  return { x: clampX(x), y: clampY(subject.y + Math.min(0.12, subject.h / 3)) };
}

export function buildTimeline(input: BuildInput): Timeline {
  const preset = PRESETS[input.preset];
  const { canvas, scenes } = input;

  // Transitions between scene i and i + 1: the brief's feel → the preset's kind and length
  const transitions: Transition[] = scenes.slice(0, -1).map((s, i) => {
    const t = preset.transitions[i === scenes.length - 2 && s.transition !== "cut" ? "reveal" : s.transition];
    return {
      kind: t.kind,
      // Alternate the side for slides and wipes, so consecutive moves don't feel mechanical
      direction: i % 2 === 0 ? "from-right" : "from-left",
      durationFrames: t.kind === "none" ? 0 : t.frames,
      lightLeak: preset.lightLeaks && (s.transition === "reveal" || i === scenes.length - 2),
    };
  });

  // Scene i shows for its content plus its incoming transition; voices run back to back
  const timed: { start: number; frames: number; contentStart: number; content: number }[] = [];
  let cursor = 0;
  scenes.forEach((s, i) => {
    const incoming = i > 0 ? transitions[i - 1].durationFrames : 0;
    const content = f(contentSeconds(s));
    const start = i === 0 ? 0 : cursor - incoming;
    timed.push({ start, frames: content + incoming, contentStart: start + incoming, content });
    cursor = start + content + incoming;
  });
  const durationInFrames = cursor;

  const layers: Layer[] = [];
  const captionWords: { words: CaptionWord[]; zone: Zone }[] = [];
  const voice: Sound[] = [];
  const speech: { from: number; to: number }[] = [];
  const sfx: Sound[] = [];
  const sfxVolume = preset.sfx.volume;
  const addSfx = (name: SfxName | null, at: number, louder = 1) => {
    const url = name ? input.sfx[name] : undefined;
    if (url && at >= 0 && at < durationInFrames) sfx.push({ url, startFrame: at, volume: Math.min(1, sfxVolume * louder) });
  };

  let steps = 0;
  const totalSteps = scenes.filter((s) => s.kind === "step").length;
  const timelineScenes: TimelineScene[] = scenes.map((s, i) => {
    const t = timed[i];
    const end = t.start + t.frames;
    const isCta = s.kind === "cta";
    const title = i === 0 ? s.overlay || input.hook : s.overlay;
    const zones = zonesFor(s, !!title && !isCta);

    // Spoken words with frame times (made voice or a talking moment)
    const spoken = s.voice?.words ?? (s.speech ? speechWords(s.speech) : []);
    const words: CaptionWord[] = spoken.map((w) => ({
      text: w.word,
      startFrame: t.contentStart + f(w.start),
      endFrame: Math.max(t.contentStart + f(w.start) + 2, t.contentStart + f(w.end)),
      emphasis: isKey(w.word, s.keywords),
    }));
    if (words.length && !isCta) captionWords.push({ words, zone: zones.captions });
    /** When the first key word is said (or a moment after the scene settles) */
    const keyFrame = words.find((w) => w.emphasis)?.startFrame ?? t.contentStart + 8;

    if (s.voice) {
      voice.push({ url: s.voice.url, startFrame: t.contentStart, volume: 1 });
      speech.push({ from: t.contentStart, to: t.contentStart + f(s.voice.durationSec) });
    }
    if (s.media.kind === "video" && s.media.volume > 0) speech.push({ from: t.contentStart, to: end });

    // The on-screen line: the hook gets the big entrance
    if (title && !isCta) {
      const start = i === 0 ? 0 : t.contentStart + 4;
      layers.push({
        kind: "title",
        role: i === 0 ? "hook" : "line",
        size: i === 0 ? "xl" : "l",
        zone: zones.title,
        startFrame: start,
        durationFrames: Math.max(f(1), end - start - 3),
        words: title.split(/\s+/).filter(Boolean).map((text) => ({ text, emphasis: isKey(text, s.keywords) })),
      });
      if (i > 0) addSfx(preset.sfx.text, start);
    }

    if (s.kind === "step") {
      steps++;
      // The step number sits with the on-screen line (drawn just above it)
      layers.push({ kind: "step", number: steps, total: totalSteps, zone: zones.title, startFrame: t.contentStart, durationFrames: t.content });
      addSfx(preset.sfx.text, t.contentStart);
    }
    if (s.stat) {
      layers.push({ kind: "stat", ...s.stat, zone: "middle", startFrame: keyFrame, durationFrames: Math.max(f(1.2), end - keyFrame) });
      addSfx(preset.sfx.reveal, keyFrame + f(0.8));
    }
    if (s.review) {
      layers.push({ kind: "review", ...s.review, zone: zones.title === "top" ? "middle" : zones.title, startFrame: t.contentStart + 4, durationFrames: t.content - 4 });
      addSfx(preset.sfx.text, t.contentStart + 4);
    }
    if (s.offer) {
      layers.push({ kind: "offer", ...s.offer, zone: zones.title === "bottom" ? "top" : "bottom", startFrame: t.contentStart + 6, durationFrames: t.content - 6 });
      addSfx(preset.sfx.reveal, t.contentStart + 6);
    }
    if (s.price) {
      const at = besideSubject(s.layout.subject, canvas, zones.title);
      layers.push({ kind: "price", text: s.price, ...at, startFrame: keyFrame, durationFrames: Math.max(f(1.2), end - keyFrame) });
      addSfx(preset.sfx.reveal, keyFrame);
    }
    if (s.sticker && preset.stickers) {
      const at = besideSubject(s.layout.subject, canvas, zones.title);
      layers.push({ kind: "sticker", emoji: s.sticker, ...at, size: 0.16, startFrame: keyFrame, durationFrames: Math.min(f(STICKER_SEC), end - keyFrame) });
      addSfx(preset.sfx.text, keyFrame, 0.9);
    }
    if (isCta) {
      layers.push({ kind: "endCard", cta: input.cta.label, line: input.cta.line, link: input.cta.link, startFrame: t.start, durationFrames: t.frames });
      addSfx(preset.sfx.cta, t.contentStart + f(0.6));
    }
    // A whoosh as the next scene arrives
    if (i < scenes.length - 1 && transitions[i].durationFrames > 0) addSfx(preset.sfx.transition, timed[i + 1].start - 2, 0.8);

    const media: SceneMedia =
      s.media.kind === "image" ? { ...s.media, motion: motionFor(s.kind, s.layout.subject, preset.zoom) } : s.media;
    const reveal =
      s.reveal && s.kind === "reveal"
        ? {
            media: s.reveal.kind === "image" ? { ...s.reveal, motion: motionFor("detail", s.layout.subject, preset.zoom * 0.5) } : s.reveal,
            atFrame: t.contentStart + Math.round(t.content * 0.35),
            durationFrames: Math.min(f(1.1), Math.round(t.content * 0.4)),
          }
        : null;
    if (reveal) addSfx(preset.sfx.reveal, reveal.atFrame);

    return {
      id: `scene-${i + 1}`,
      kind: s.kind,
      startFrame: t.start,
      durationFrames: t.frames,
      media,
      reveal,
      backdrop: isCta ? "blur" : s.kind === "review" || s.kind === "stat" || s.kind === "offer" ? "dim" : "plain",
      subject: s.layout.subject,
      // Light pictures need a stronger shade behind white text
      scrim: s.layout.light === true ? 0.6 : s.layout.light === false ? 0.3 : 0.45,
    };
  });

  const captions = captionWords.flatMap((c) => pages(c.words, preset.captions.wordsPerPage, c.zone));
  const ctaStart = timelineScenes.find((s) => s.kind === "cta")?.startFrame ?? durationInFrames;
  const music = input.music
    ? {
        url: input.music.url,
        volume: preset.music.volume,
        duckedVolume: preset.music.ducked,
        speech,
        fadeInFrames: f(0.5),
        fadeOutFrames: f(1),
      }
    : null;

  return {
    version: 1,
    width: canvas.width,
    height: canvas.height,
    fps: FPS,
    durationInFrames,
    preset: preset.id,
    theme: input.theme,
    safe: canvas.safe,
    scenes: timelineScenes,
    transitions,
    captions,
    layers,
    audio: { voice, music, sfx },
    logoBug: input.theme.logo && preset.logoBug ? { corner: preset.logoBug, untilFrame: ctaStart } : null,
    progressBar: input.progressBar,
  };
}
