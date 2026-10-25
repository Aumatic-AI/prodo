import { ImageResponse } from "next/og";
import { MARK } from "@/components/kit/Logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS adds its own rounded corners, so the tile is a full square here
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, display: "flex", background: MARK.tile }}>
        <svg width="180" height="180" viewBox="0 0 32 32">
          <path d={MARK.p} fill="none" stroke={MARK.ink} strokeWidth={MARK.stroke} strokeLinejoin="round" />
          <circle cx={MARK.dot.cx} cy={MARK.dot.cy} r={MARK.dot.r} fill={MARK.accent} />
        </svg>
      </div>
    ),
    size
  );
}
