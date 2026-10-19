import { ImageResponse } from "next/og";

/**
 * Composites the business's exact logo onto a generated photo, top-right,
 * like a watermark. Asking the generative image model to "place this exact
 * logo" doesn't work reliably — it's a diffusion model, so it redraws the
 * logo region (including inventing a background behind it) instead of
 * pasting it pixel-for-pixel. This renders the real uploaded logo file
 * on top of the photo deterministically, so it's never altered.
 */

const DIMENSIONS: Record<"1:1" | "4:5" | "9:16" | "16:9", { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

export interface ComposeCreativeImageInput {
  photoUrl: string;
  logoUrl?: string | null;
  aspectRatio: "1:1" | "4:5" | "9:16" | "16:9";
}

export async function composeCreativeImage(input: ComposeCreativeImageInput): Promise<Buffer | null> {
  if (!input.logoUrl) return null;

  const { width, height } = DIMENSIONS[input.aspectRatio];
  const margin = Math.round(width * 0.04);
  const logoWidth = Math.round(width * 0.22);

  const image = new ImageResponse(
    (
      <div style={{ width, height, display: "flex", position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- satori's own JSX subset for next/og, not a real DOM <img> */}
        <img
          src={input.photoUrl}
          width={width}
          height={height}
          style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img
          src={input.logoUrl}
          width={logoWidth}
          style={{ position: "absolute", top: margin, right: margin, objectFit: "contain" }}
        />
      </div>
    ),
    { width, height }
  );

  return Buffer.from(await image.arrayBuffer());
}
