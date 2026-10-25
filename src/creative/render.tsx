import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import type { Canvas } from "./sizes";
import type { CreativeTheme } from "./theme";

// Renders a layout to PNG with Satori (next/og). Our code draws every word on an ad: the image
// model only ever makes the photo behind it.

type Weight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export async function renderPng(element: ReactElement, canvas: Canvas, theme: CreativeTheme): Promise<Buffer> {
  const image = new ImageResponse(element, {
    width: canvas.width,
    height: canvas.height,
    fonts: theme.fontFiles.map((f) => ({ name: f.family, data: f.data, weight: f.weight as Weight, style: "normal" as const })),
  });
  return Buffer.from(await image.arrayBuffer());
}
