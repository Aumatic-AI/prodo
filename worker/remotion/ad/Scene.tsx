// One scene's picture: a clip (played, slowed or held on its last frame to fill the scene), a still
// with its camera move, or a brand colour; the before/after wipe; and the shading that keeps text
// readable. Times are relative to the scene (it plays inside its own Sequence).

import { Video } from "@remotion/media";
import { AbsoluteFill, Easing, Freeze, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { SceneMedia, TimelineScene } from "../shared/timeline.ts";

function Clip({ media, frames }: { media: Extract<SceneMedia, { kind: "video" }>; frames: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Frames the moment can fill at its playback rate; after that its last frame holds
  const playable = Math.max(1, Math.floor(((media.trimEndSec - media.trimStartSec) / media.playbackRate) * fps));
  const holding = frame >= playable && playable < frames;
  return (
    <Freeze frame={playable - 1} active={holding}>
      <Video
        src={media.url}
        trimBefore={Math.round(media.trimStartSec * fps)}
        playbackRate={media.playbackRate}
        volume={media.volume}
        muted={media.volume === 0}
        objectFit="cover"
        style={{ width: "100%", height: "100%" }}
      />
    </Freeze>
  );
}

function Still({ media, frames }: { media: Extract<SceneMedia, { kind: "image" }>; frames: number }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, Math.max(1, frames)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
  const m = media.motion;
  const scale = m.fromScale + (m.toScale - m.fromScale) * p;
  const x = (m.fromX + (m.toX - m.fromX) * p) * 100;
  const y = (m.fromY + (m.toY - m.fromY) * p) * 100;
  return <Img src={media.url} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `translate(${x}%, ${y}%) scale(${scale})` }} />;
}

export function Picture({ media, frames }: { media: SceneMedia; frames: number }) {
  if (media.kind === "video") return <Clip media={media} frames={frames} />;
  if (media.kind === "image") return <Still media={media} frames={frames} />;
  return <AbsoluteFill style={{ background: media.color }} />;
}

/** Before → after: the after picture wipes in from the left behind a bright divider. */
function Reveal({ reveal, frames }: { reveal: NonNullable<TimelineScene["reveal"]>; frames: number }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const p = interpolate(frame, [reveal.atFrame, reveal.atFrame + reveal.durationFrames], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  if (p <= 0) return null;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(0 ${100 - p}% 0 0)` }}>
        <Picture media={reveal.media} frames={frames} />
      </AbsoluteFill>
      {p < 100 && <div style={{ position: "absolute", top: 0, bottom: 0, left: `${p}%`, width: Math.max(4, width * 0.006), marginLeft: -2, background: "#ffffff", boxShadow: "0 0 24px rgba(255,255,255,0.8)" }} />}
    </AbsoluteFill>
  );
}

export function SceneView({ scene }: { scene: TimelineScene }) {
  const blurred = scene.backdrop === "blur";
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={blurred ? { filter: "blur(28px)", transform: "scale(1.1)" } : undefined}>
        <Picture media={scene.media} frames={scene.durationFrames} />
      </AbsoluteFill>
      {scene.reveal && <Reveal reveal={scene.reveal} frames={scene.durationFrames} />}
      {/* Cards and the end card sit on a calmer picture */}
      {scene.backdrop !== "plain" && <AbsoluteFill style={{ background: `rgba(0,0,0,${blurred ? 0.45 : 0.4})` }} />}
      {/* Shade at the top and bottom so white words read on any picture; stronger on light pictures */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(0,0,0,${0.55 * scene.scrim}) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 62%, rgba(0,0,0,${0.75 * scene.scrim}) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
}
