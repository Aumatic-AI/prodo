// What sits over the whole video: the small logo in a corner, the progress bar, film grain and the
// warm light leaks on reveals. Plain CSS and SVG, so renders stay fast without a graphics card.

import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Timeline } from "../shared/timeline.ts";
import { highlight, logoFor } from "./layout.ts";

export function LogoBug({ timeline }: { timeline: Timeline }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const bug = timeline.logoBug;
  const logo = logoFor(timeline.theme, "#000000");
  if (!bug || !logo || frame >= bug.untilFrame) return null;
  const opacity = interpolate(frame, [6, 16, bug.untilFrame - 8, bug.untilFrame], [0, 0.92, 0.92, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const side = bug.corner === "top-left" ? { left: timeline.safe.left } : { right: timeline.safe.right };
  return (
    <div style={{ position: "absolute", top: timeline.safe.top * 0.55, ...side, opacity, background: logo.plate ?? undefined, borderRadius: width * 0.015, padding: logo.plate ? width * 0.01 : 0, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}>
      <Img src={logo.src} style={{ display: "block", maxWidth: width * 0.2, maxHeight: width * 0.07, objectFit: "contain" }} />
    </div>
  );
}

export function ProgressBar({ timeline }: { timeline: Timeline }) {
  const frame = useCurrentFrame();
  const { width, durationInFrames } = useVideoConfig();
  if (!timeline.progressBar) return null;
  // Stops where the closing card starts
  const end = timeline.scenes.find((s) => s.kind === "cta")?.startFrame ?? durationInFrames;
  if (frame >= end) return null;
  const h = Math.max(6, width * 0.007);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: h, background: "rgba(255,255,255,0.25)" }}>
      <div style={{ width: `${Math.min(100, (frame / end) * 100)}%`, height: "100%", background: highlight(timeline.theme) }} />
    </div>
  );
}

/** Subtle moving film grain (same frame → same grain). */
export function Grain({ amount }: { amount: number }) {
  const frame = useCurrentFrame();
  if (amount <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity: amount * 3, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 12} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
}

/** A warm flash of light sweeping across, centred on a cut. */
export function LightLeak({ at, frames }: { at: number; frames: number }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const span = Math.max(frames, 18);
  const p = interpolate(frame, [at - span / 2, at + span / 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (p <= 0 || p >= 1) return null;
  const strength = Math.sin(p * Math.PI);
  const x = -0.3 + p * 1.6;
  return (
    <AbsoluteFill
      style={{
        mixBlendMode: "screen",
        opacity: strength * 0.85,
        background: `radial-gradient(ellipse ${width * 0.9}px ${height * 0.6}px at ${x * 100}% 35%, rgba(255,190,110,0.95), rgba(255,120,60,0.45) 40%, rgba(255,80,40,0) 70%), radial-gradient(ellipse ${width * 0.6}px ${height * 0.4}px at ${(1 - x) * 100}% 75%, rgba(255,230,170,0.6), rgba(255,200,120,0) 70%)`,
      }}
    />
  );
}
