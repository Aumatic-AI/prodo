// Renders every ad layout, carousel slide and end card with a sample brand, so the designs can be
// looked at without running the agents. Usage: npm run smoke scripts/check/render-samples.tsx <out-dir>
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import React from "react";
import type { CanvasRatio } from "@/creative/sizes";
import type { CreativeTheme } from "@/creative/theme";

// tsx compiles JSX to React.createElement (Next uses the automatic runtime), so make React global first
(globalThis as unknown as { React: typeof React }).React = React;
const { renderPng } = await import("@/creative/render");
const { CANVAS } = await import("@/creative/sizes");
const { AD_TEMPLATES } = await import("@/creative/templates/ads");
const { ContentSlide, CoverSlide, CtaSlide, EndCard } = await import("@/creative/templates/carousel");
const { readableOn } = await import("@/creative/theme");
const { TEMPLATE_IDS } = await import("@/core/creative/brief");

const out = process.argv[2] ?? ".logs/renders";

async function googleFont(family: string, weight: number) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`)).text();
  const url = css.match(/src:\s*url\((https:[^)]+\.ttf)\)/)![1];
  return { family, weight, data: await (await fetch(url)).arrayBuffer(), key: "" };
}

// A stand-in "photo": soft gradient with shapes (no network image needed)
async function samplePhoto(): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d9b1"/><stop offset="1" stop-color="#b86b4b"/></linearGradient></defs>
    <rect width="1200" height="1500" fill="url(#g)"/>
    <circle cx="820" cy="520" r="300" fill="#fff4e0" opacity="0.55"/>
    <rect x="160" y="760" width="760" height="420" rx="60" fill="#5b3a2e" opacity="0.8"/>
    <rect x="220" y="700" width="640" height="120" rx="40" fill="#8a5a44"/>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

const primary = "#1f6f5c";
const accent = "#f2b134";
const theme: CreativeTheme = {
  businessName: "Stone & Wood",
  primary: { bg: primary, text: readableOn(primary) },
  accent: { bg: accent, text: readableOn(accent) },
  light: { bg: "#fbf8f3", text: "#1d1d1b" },
  dark: { bg: "#1d2a26", text: "#ffffff" },
  fonts: { heading: "Playfair Display", body: "Inter" },
  fontFiles: [],
  logo: { onLight: null, onDark: null },
};

await mkdir(out, { recursive: true });
theme.fontFiles = await Promise.all([googleFont("Playfair Display", 800), googleFont("Inter", 400), googleFont("Inter", 600)]);
const photoUrl = await samplePhoto();

const ad = { photoUrl, headline: "Handmade oak tables that last for generations", subhead: "Built to order in our Mosta workshop, delivered across Malta", cta: "Shop the collection", badge: "From €890" };
for (const id of TEMPLATE_IDS) {
  for (const ratio of ["4:5", "1:1", "9:16", "16:9"] as CanvasRatio[]) {
    const canvas = CANVAS[ratio];
    const Template = AD_TEMPLATES[id];
    await writeFile(join(out, `ad-${id}-${ratio.replace(":", "x")}.png`), await renderPng(Template({ canvas, theme, ...ad }), canvas, theme));
  }
}

const slides = CANVAS["4:5"];
await writeFile(join(out, "carousel-1-cover.png"), await renderPng(<CoverSlide canvas={slides} theme={theme} index={0} total={5} photoUrl={photoUrl} title="5 things to check before buying a dining table" />, slides, theme));
await writeFile(join(out, "carousel-2.png"), await renderPng(<ContentSlide canvas={slides} theme={theme} index={1} total={5} title="Solid wood, not veneer" body="Veneer chips and peels. Solid oak can be sanded and refinished for decades, so it ages with your family instead of against it." />, slides, theme));
await writeFile(join(out, "carousel-3.png"), await renderPng(<ContentSlide canvas={slides} theme={theme} index={2} total={5} title="Joinery you can see" body="Mortise and tenon joints hold for generations. Screws and brackets loosen." />, slides, theme));
await writeFile(join(out, "carousel-5-cta.png"), await renderPng(<CtaSlide canvas={slides} theme={theme} index={4} total={5} title="Find your table" body="Visit the workshop or browse the collection online." cta="Book a visit" />, slides, theme));
for (const ratio of ["9:16", "4:5"] as CanvasRatio[]) {
  const c = CANVAS[ratio];
  await writeFile(join(out, `end-card-${ratio.replace(":", "x")}.png`), await renderPng(<EndCard canvas={c} theme={theme} cta="Shop the collection" line="Made to last generations" />, c, theme));
}
console.log(`Rendered into ${out}`);
