// A small Timeline with brand colours only (no files), so the Studio opens on something and a
// render can be checked without any media. Prodo sends real ones.

import { FPS, type Timeline } from "../shared/timeline.ts";

const s = (n: number) => Math.round(n * FPS);
const color = (c: string) => ({ kind: "color" as const, color: c });
const plain = { reveal: null, backdrop: "plain" as const, subject: null, scrim: 0.4 };

export const sampleTimeline: Timeline = {
  version: 1,
  width: 1080,
  height: 1920,
  fps: FPS,
  durationInFrames: s(11.5),
  preset: "bold",
  theme: {
    primary: { bg: "#2F45C5", text: "#ffffff" },
    accent: { bg: "#FFC83D", text: "#15171C" },
    light: { bg: "#ffffff", text: "#15171C" },
    dark: { bg: "#15171C", text: "#ffffff" },
    heading: "DejaVu Sans",
    body: "DejaVu Sans",
    fonts: [],
    logo: null,
    businessName: "Prodo",
  },
  safe: { top: 260, right: 120, bottom: 600, left: 90 },
  scenes: [
    { id: "scene-1", kind: "hook", startFrame: 0, durationFrames: s(3), media: color("#2F45C5"), ...plain },
    { id: "scene-2", kind: "stat", startFrame: s(3) - 9, durationFrames: s(3.5) + 9, media: color("#1E2A78"), ...plain, backdrop: "dim" },
    { id: "scene-3", kind: "cta", startFrame: s(6.5) - 12, durationFrames: s(5) + 12, media: color("#15171C"), ...plain, backdrop: "blur" },
  ],
  transitions: [
    { kind: "wipe", direction: "from-right", durationFrames: 9, lightLeak: false },
    { kind: "zoom", direction: "from-left", durationFrames: 12, lightLeak: false },
  ],
  captions: [],
  layers: [
    { kind: "title", role: "hook", size: "xl", zone: "middle", startFrame: 0, durationFrames: s(2.9), words: [{ text: "Videos", emphasis: false }, { text: "that", emphasis: false }, { text: "sell", emphasis: true }] },
    { kind: "stat", value: 4.9, decimals: 1, prefix: "", suffix: "★", label: "from 120 reviews", zone: "middle", startFrame: s(3.2), durationFrames: s(3) },
    { kind: "sticker", emoji: "🔥", x: 0.76, y: 0.32, size: 0.16, startFrame: s(3.6), durationFrames: s(1.6) },
    { kind: "endCard", cta: "Book now", line: "Made by Prodo", link: "prodo.app", startFrame: s(6.5) - 12, durationFrames: s(5) + 12 },
  ],
  audio: { voice: [], music: null, sfx: [] },
  logoBug: null,
  progressBar: true,
};
