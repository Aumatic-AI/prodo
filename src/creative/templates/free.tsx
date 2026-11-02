import type { LogoCorner } from "@/core/creative/brief";
import type { Canvas } from "../sizes";
import type { CreativeTheme } from "../theme";
import { LogoImg, flex, logoFor, Photo } from "./parts";

// A free image ad: the image model already painted the whole ad, words included. Code only fits it
// to the size and adds the brand's logo, as it is, in the corner the Creative Director chose: the
// version that reads on what is behind it. No plate, shadow or other styling.

export interface FreeAdProps {
  canvas: Canvas;
  theme: CreativeTheme;
  photoUrl: string;
  corner: LogoCorner;
  /** The picture behind the logo is light, so the dark logo version reads */
  light: boolean;
}

export function FreeAd({ canvas, theme, photoUrl, corner, light }: FreeAdProps) {
  const unit = Math.min(canvas.width, canvas.height) / 1080;
  const logoWidth = 300 * unit;
  const right = corner.endsWith("right");
  // The right version for the background; the only one the brand has when it has just one
  const src = logoFor(theme, light ? "#ffffff" : "#000000") ?? theme.logo.onLight ?? theme.logo.onDark;
  const top = corner.startsWith("top");
  return (
    <div style={flex({ width: canvas.width, height: canvas.height, position: "relative", background: "#000" })}>
      <Photo src={photoUrl} width={canvas.width} height={canvas.height} style={{ position: "absolute", top: 0, left: 0 }} />
      <div
        style={flex({
          position: "absolute",
          width: logoWidth,
          justifyContent: right ? "flex-end" : "flex-start",
          ...(right ? { right: canvas.safe.right } : { left: canvas.safe.left }),
          ...(top ? { top: canvas.safe.top } : { bottom: canvas.safe.bottom }),
        })}
      >
        <LogoImg src={src} height={64 * unit} maxWidth={logoWidth} align={right ? "right" : "left"} />
      </div>
    </div>
  );
}
