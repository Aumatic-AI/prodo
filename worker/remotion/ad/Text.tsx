// Words on screen: the big kinetic line (the hook, a scene's line) and the word-by-word captions of
// what is said. Style comes from the preset; zone, timing and which words stand out from the Timeline.

import { evolvePath } from "@remotion/paths";
import type { CSSProperties } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Preset } from "../shared/presets.ts";
import type { CaptionPage, Layer, Theme, Timeline } from "../shared/timeline.ts";
import { family, highlight, readable, zoneBox } from "./layout.ts";

type TitleLayer = Extract<Layer, { kind: "title" }>;

const UNDERLINE = "M 2 7 Q 30 3 55 6 T 98 5";

/** One word of a title: arrives in turn (staggered), key words stand out the preset's way. */
function TitleWord({ text, emphasis, index, preset, theme, size }: { text: string; emphasis: boolean; index: number; preset: Preset; theme: Theme; size: number }) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const delay = index * (preset.titles.enter === "pop" ? 3 : 2);
  const s = spring({ frame: frame - delay, fps, config: { stiffness: preset.titles.stiffness, damping: preset.titles.damping } });
  const enter: CSSProperties =
    preset.titles.enter === "pop"
      ? { transform: `scale(${interpolate(s, [0, 1], [0.4, 1])})`, opacity: Math.min(1, s * 2) }
      : preset.titles.enter === "rise"
        ? { transform: `translateY(${(1 - s) * size * 0.6}px)`, opacity: s }
        : preset.titles.enter === "slide"
          ? { transform: `translateX(${(1 - s) * -size * 0.8}px)`, opacity: s }
          : { opacity: interpolate(frame - delay, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) };

  const mode = preset.titles.emphasis;
  const box = emphasis && mode === "box";
  const underline = emphasis && mode === "underline";
  const draw = evolvePath(interpolate(frame - delay - 6, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), UNDERLINE);

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        margin: `0 ${size * 0.12}px`,
        padding: box ? `0 ${size * 0.18}px` : undefined,
        borderRadius: box ? size * 0.14 : undefined,
        background: box ? theme.accent.bg : undefined,
        ...(box ? { color: theme.accent.text, WebkitTextStroke: undefined, textShadow: "none" } : {}),
        ...(emphasis && mode === "color" ? { color: highlight(theme) } : {}),
        ...enter,
      }}
    >
      {text}
      {underline && (
        <svg viewBox="0 0 100 10" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, bottom: -size * 0.12, width: "100%", height: size * 0.22 }}>
          <path d={UNDERLINE} fill="none" stroke={theme.accent.bg} strokeWidth={Math.max(2, width * 0.0016)} strokeLinecap="round" strokeDasharray={draw.strokeDasharray} strokeDashoffset={draw.strokeDashoffset} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </span>
  );
}

export function Title({ layer, preset, timeline, stepAbove }: { layer: TitleLayer; preset: Preset; timeline: Timeline; stepAbove?: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const scale = layer.size === "xl" ? 1 : layer.size === "l" ? 0.78 : 0.62;
  // Longer lines get smaller so they stay on 2–3 lines
  const letters = layer.words.reduce((n, w) => n + w.text.length + 1, 0);
  const fit = Math.min(1, 26 / Math.max(10, letters));
  const size = width * preset.titles.size * scale * (0.72 + 0.28 * fit);
  const out = interpolate(frame, [layer.durationFrames - 6, layer.durationFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={zoneBox(layer.zone, timeline.safe)}>
      {stepAbove}
      <div
        style={{
          fontFamily: family(timeline.theme.heading),
          fontWeight: preset.titles.weight,
          fontSize: size,
          lineHeight: 1.12,
          textAlign: "center",
          textTransform: preset.titles.uppercase ? "uppercase" : undefined,
          letterSpacing: preset.titles.uppercase ? size * 0.01 : -size * 0.01,
          opacity: out,
          maxWidth: "100%",
          ...readable(0.8, width),
        }}
      >
        {layer.words.map((w, i) => (
          <TitleWord key={i} text={w.text} emphasis={w.emphasis} index={i} preset={preset} theme={timeline.theme} size={size} />
        ))}
      </div>
    </div>
  );
}

/** The caption page on screen at this frame: the spoken word lights up, key words stand out. */
export function Captions({ pages, preset, timeline }: { pages: CaptionPage[]; preset: Preset; timeline: Timeline }) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const page = pages.find((p) => frame >= p.startFrame && frame < p.endFrame);
  if (!page) return null;
  const size = width * preset.captions.size;
  const enter = spring({ frame: frame - page.startFrame, fps, config: { damping: 200 }, durationInFrames: 6 });
  const accent = timeline.theme.accent;
  const lightUp = highlight(timeline.theme);
  return (
    <div style={zoneBox(page.zone, timeline.safe)}>
      <div
        style={{
          fontFamily: family(timeline.theme.heading),
          fontWeight: preset.captions.weight,
          fontSize: size,
          lineHeight: 1.18,
          textAlign: "center",
          textTransform: preset.captions.uppercase ? "uppercase" : undefined,
          maxWidth: "88%",
          transform: `translateY(${(1 - enter) * size * 0.4}px) scale(${0.85 + 0.15 * enter})`,
          ...readable(preset.captions.stroke, width),
        }}
      >
        {page.words.map((w, i) => {
          const active = frame >= w.startFrame && frame < Math.max(w.endFrame, w.startFrame + 3);
          const mode = preset.captions.active;
          const lit = active || w.emphasis;
          const style: CSSProperties =
            mode === "box" && active
              ? { background: accent.bg, color: accent.text, WebkitTextStroke: undefined, textShadow: "none", borderRadius: size * 0.16, padding: `0 ${size * 0.16}px` }
              : mode === "scale" && active
                ? { transform: "scale(1.14)", color: lightUp }
                : lit
                  ? { color: lightUp }
                  : {};
          return (
            <span key={i} style={{ display: "inline-block", margin: `0 ${size * 0.12}px`, transition: "none", ...style }}>
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
