// A short test video: proves the worker can render after a deploy. A photo (optional) slowly
// zooms in behind a title that slides up, on the brand colour.

import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// A type, not an interface: Remotion needs props it can treat as a plain record
export type CheckProps = {
  title: string;
  /** Background colour, e.g. "#2f45c5" */
  color: string;
  /** Optional photo (a link on our storage) */
  image?: string | null;
};

export const checkDefaults: CheckProps = { title: "Prodo renders work", color: "#2f45c5", image: null };

export function Check({ title, color, image }: CheckProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.12]);
  const rise = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ background: color }}>
      {image && <Img src={image} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})`, opacity: 0.85 }} />}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: width * 0.08 }}>
        <div
          style={{
            color: "#ffffff",
            fontFamily: "DejaVu Sans, sans-serif",
            fontWeight: 800,
            fontSize: width * 0.08,
            textAlign: "center",
            lineHeight: 1.1,
            opacity: rise,
            transform: `translateY(${(1 - rise) * 60}px)`,
          }}
        >
          {title}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
