// Cards and stickers drawn over the picture: a counting number, a review with stars, the price on a
// burst, the offer, a step number, an emoji sticker and the closing card. All facts come from the
// Timeline (stored facts in Prodo); nothing here invents text.

import { noise2D } from "@remotion/noise";
import { makeStar } from "@remotion/shapes";
import { Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Preset } from "../shared/presets.ts";
import type { Layer, Timeline } from "../shared/timeline.ts";
import { EMOJI_FONT, family, highlight, logoFor, readable, zoneBox } from "./layout.ts";

type L<K extends Layer["kind"]> = Extract<Layer, { kind: K }>;

/** A springy entrance, shared by every card (bouncier for playful and bold looks). */
function useEnter(preset: Preset, delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bouncy = preset.titles.enter === "pop";
  return spring({ frame: frame - delay, fps, config: bouncy ? { damping: 11, stiffness: 180 } : { damping: 200 } });
}

/** Fade out over the last frames of a layer. */
function useExit(durationFrames: number, frames = 6) {
  const frame = useCurrentFrame();
  return interpolate(frame, [durationFrames - frames, durationFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

export function Stat({ layer, preset, timeline }: { layer: L<"stat">; preset: Preset; timeline: Timeline }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const enter = useEnter(preset);
  const out = useExit(layer.durationFrames);
  const counted = interpolate(frame, [0, 26], [0, layer.value], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const shown = counted.toLocaleString("en-US", { minimumFractionDigits: layer.decimals, maximumFractionDigits: layer.decimals });
  const size = width * 0.2;
  return (
    <div style={zoneBox(layer.zone, timeline.safe)}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: out, transform: `scale(${0.6 + 0.4 * enter})` }}>
        <div style={{ fontFamily: family(timeline.theme.heading), fontWeight: 900, fontSize: size, lineHeight: 1, fontVariantNumeric: "tabular-nums", ...readable(1, width), WebkitTextStroke: undefined, color: highlight(timeline.theme) }}>
          {layer.prefix}
          {shown}
          {layer.suffix}
        </div>
        <div style={{ marginTop: size * 0.12, fontFamily: family(timeline.theme.body), fontWeight: 700, fontSize: size * 0.24, textAlign: "center", maxWidth: width * 0.75, ...readable(0.6, width) }}>{layer.label}</div>
      </div>
    </div>
  );
}

function Stars({ rating, size, color, delay }: { rating: number; size: number; color: string; delay: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const star = makeStar({ points: 5, innerRadius: size * 0.22, outerRadius: size * 0.5 });
  return (
    <div style={{ display: "flex", gap: size * 0.15 }}>
      {Array.from({ length: 5 }, (_, i) => {
        const s = spring({ frame: frame - delay - i * 3, fps, config: { damping: 12, stiffness: 200 } });
        const filled = i < Math.round(rating);
        return (
          <svg key={i} width={star.width} height={star.height} style={{ transform: `scale(${s})` }}>
            <path d={star.path} fill={filled ? color : "rgba(0,0,0,0.15)"} />
          </svg>
        );
      })}
    </div>
  );
}

export function Review({ layer, preset, timeline }: { layer: L<"review">; preset: Preset; timeline: Timeline }) {
  const { width } = useVideoConfig();
  const frame = useCurrentFrame();
  const enter = useEnter(preset);
  const out = useExit(layer.durationFrames);
  const card = timeline.theme.light;
  const radius = width * preset.radius;
  // Longer quotes get smaller type; words appear one after another
  const words = layer.text.split(/\s+/);
  const size = width * Math.max(0.038, Math.min(0.056, 2.6 / Math.max(30, words.length)));
  const visible = Math.floor(interpolate(frame, [8, 8 + words.length * 1.6], [0, words.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <div style={zoneBox(layer.zone, timeline.safe)}>
      <div
        style={{
          width: "100%",
          background: card.bg,
          color: card.text,
          borderRadius: radius,
          padding: width * 0.055,
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          opacity: out,
          transform: `translateY(${(1 - enter) * width * 0.12}px) scale(${0.92 + 0.08 * enter})`,
          display: "flex",
          flexDirection: "column",
          gap: width * 0.03,
        }}
      >
        {layer.rating !== null && <Stars rating={layer.rating} size={width * 0.075} color="#F5B301" delay={4} />}
        <div style={{ fontFamily: family(timeline.theme.body), fontSize: size, lineHeight: 1.35, fontWeight: 600 }}>
          “{words.map((w, i) => <span key={i} style={{ opacity: i < visible ? 1 : 0 }}>{w} </span>)}”
        </div>
        {layer.author && <div style={{ fontFamily: family(timeline.theme.body), fontSize: size * 0.8, fontWeight: 700, opacity: 0.75 }}>— {layer.author}</div>}
      </div>
    </div>
  );
}

export function Price({ layer, preset, timeline }: { layer: L<"price">; preset: Preset; timeline: Timeline }) {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const enter = useEnter(preset);
  const out = useExit(layer.durationFrames);
  const size = width * 0.3;
  const burst = makeStar({ points: 14, innerRadius: size * 0.42, outerRadius: size * 0.5 });
  const wobble = Math.sin(frame / 9) * 2;
  const color = timeline.theme.accent;
  return (
    <div
      style={{
        position: "absolute",
        left: layer.x * width - size / 2,
        top: layer.y * height - size / 2,
        width: size,
        height: size,
        opacity: out,
        transform: `scale(${enter}) rotate(${-10 + wobble}deg)`,
        filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.35))",
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${burst.width} ${burst.height}`} style={{ position: "absolute", inset: 0 }}>
        <path d={burst.path} fill={color.bg} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: family(timeline.theme.heading), fontWeight: 900, fontSize: size * (layer.text.length > 7 ? 0.17 : 0.22), color: color.text, lineHeight: 1 }}>
        {layer.text}
      </div>
    </div>
  );
}

export function Offer({ layer, preset, timeline }: { layer: L<"offer">; preset: Preset; timeline: Timeline }) {
  const { width } = useVideoConfig();
  const enter = useEnter(preset);
  const out = useExit(layer.durationFrames);
  const color = timeline.theme.primary;
  return (
    <div style={zoneBox(layer.zone, timeline.safe)}>
      <div
        style={{
          background: color.bg,
          color: color.text,
          borderRadius: width * preset.radius,
          padding: `${width * 0.035}px ${width * 0.05}px`,
          textAlign: "center",
          opacity: out,
          transform: `translateY(${(1 - enter) * width * 0.15}px)`,
          boxShadow: "0 18px 48px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ fontFamily: family(timeline.theme.heading), fontWeight: 900, fontSize: width * 0.07, lineHeight: 1.1 }}>{layer.title}</div>
        {layer.detail && <div style={{ fontFamily: family(timeline.theme.body), fontWeight: 600, fontSize: width * 0.036, marginTop: width * 0.012, opacity: 0.9 }}>{layer.detail}</div>}
      </div>
    </div>
  );
}

/** "Step 2 of 4", shown above the scene's line. */
export function StepBadge({ layer, preset, timeline }: { layer: L<"step">; preset: Preset; timeline: Timeline }) {
  const { width } = useVideoConfig();
  const enter = useEnter(preset);
  const color = timeline.theme.accent;
  return (
    <div
      style={{
        marginBottom: width * 0.025,
        background: color.bg,
        color: color.text,
        borderRadius: 999,
        padding: `${width * 0.012}px ${width * 0.035}px`,
        fontFamily: family(timeline.theme.heading),
        fontWeight: 800,
        fontSize: width * 0.042,
        transform: `scale(${enter})`,
      }}
    >
      Step {layer.number}
      <span style={{ opacity: 0.7 }}> / {layer.total}</span>
    </div>
  );
}

export function Sticker({ layer, preset }: { layer: L<"sticker">; preset: Preset }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const enter = useEnter(preset);
  const out = useExit(layer.durationFrames, 5);
  const size = layer.size * width;
  // A gentle, repeatable wobble (same frame → same angle)
  const tilt = noise2D("sticker", frame / 25, layer.x * 10) * 10;
  const bob = noise2D("bob", frame / 30, layer.y * 10) * size * 0.05;
  return (
    <div
      style={{
        position: "absolute",
        left: layer.x * width - size / 2,
        top: layer.y * height - size / 2 + bob,
        width: size,
        height: size,
        fontSize: size * 0.82,
        lineHeight: 1,
        textAlign: "center",
        fontFamily: EMOJI_FONT,
        opacity: out,
        transform: `scale(${enter * (1 + 0.04 * Math.sin(frame / 4))}) rotate(${tilt}deg)`,
        filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.35))",
      }}
    >
      {layer.emoji}
    </div>
  );
}

export function EndCard({ layer, preset, timeline }: { layer: L<"endCard">; preset: Preset; timeline: Timeline }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const t = timeline.theme;
  const logo = logoFor(t, "#000000");
  const brand = useEnter(preset, 6);
  const line = useEnter(preset, 12);
  const button = useEnter(preset, 18);
  const pulse = 1 + 0.03 * Math.sin(Math.max(0, frame - 30) * 0.25);
  return (
    <div style={{ ...zoneBox("middle", timeline.safe), gap: width * 0.05 }}>
      <div style={{ transform: `scale(${brand})`, opacity: brand }}>
        {logo ? (
          <div style={{ background: logo.plate ?? undefined, borderRadius: width * 0.03, padding: logo.plate ? width * 0.03 : 0 }}>
            <Img src={logo.src} style={{ display: "block", maxWidth: width * 0.5, maxHeight: width * 0.2, objectFit: "contain" }} />
          </div>
        ) : (
          <div style={{ fontFamily: family(t.heading), fontWeight: 900, fontSize: width * 0.085, ...readable(0.6, width) }}>{t.businessName}</div>
        )}
      </div>
      {layer.line && (
        <div style={{ fontFamily: family(t.heading), fontWeight: preset.titles.weight, fontSize: width * 0.062, lineHeight: 1.15, textAlign: "center", opacity: line, transform: `translateY(${(1 - line) * 40}px)`, ...readable(0.6, width) }}>
          {layer.line}
        </div>
      )}
      <div
        style={{
          background: t.primary.bg,
          color: t.primary.text,
          borderRadius: 999,
          padding: `${width * 0.03}px ${width * 0.075}px`,
          fontFamily: family(t.heading),
          fontWeight: 800,
          fontSize: width * 0.055,
          transform: `scale(${button * pulse})`,
          boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
        }}
      >
        {layer.cta}
      </div>
      {layer.link && <div style={{ fontFamily: family(t.body), fontWeight: 600, fontSize: width * 0.036, opacity: button * 0.9, ...readable(0.4, width) }}>{layer.link}</div>}
    </div>
  );
}
