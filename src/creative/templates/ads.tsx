import type { Design, TemplateId } from "@/core/creative/brief";
import { fitText } from "../fit";
import { safeBox, type Canvas } from "../sizes";
import type { CreativeTheme } from "../theme";
import { Brand, CtaLine, FloatingPrice, flex, Photo, PriceLine } from "./parts";

// Eight image ad layouts. Each works at 1:1, 4:5, 9:16 and 16:9: sizes come from the canvas and the
// safe zone, and text is sized to fit its box. Inside a layout the ad varies with the brief's design
// (alignment, headline case, price style) and with the finished photo: words go on its calm side,
// the logo where it reads, and every size is cropped around the subject.

/** What code found in the finished photo */
export interface PhotoLook {
  /** The calm band for words */
  zone: "top" | "bottom";
  /** That band is light, so dark words read better there */
  zoneLight: boolean;
  /** Whether the top and bottom edges are light (for the logo) */
  topLight: boolean;
  bottomLight: boolean;
  /** The subject's centre, as fractions of the photo */
  focus: { x: number; y: number };
}

export const DEFAULT_LOOK: PhotoLook = { zone: "bottom", zoneLight: false, topLight: false, bottomLight: false, focus: { x: 0.5, y: 0.42 } };

export interface AdProps {
  canvas: Canvas;
  theme: CreativeTheme;
  photoUrl: string;
  headline: string;
  subhead: string | null;
  /** The call to action in words ("Shop the kimono") */
  cta: string;
  /** Where to go, as people read it ("royal-gypsy.com") */
  link: string | null;
  /** The price or the deal */
  badge: string | null;
  design: Design;
  photo: PhotoLook;
}

const INK = "#141414";
const unitOf = (c: Canvas) => Math.min(c.width, c.height) / 1080;
const isUpper = (d: Design) => d.headlineCase === "upper";
const tint = (light: boolean, alpha: number) => (light ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`);
const textShadow = (light: boolean) => (light ? "none" : "0 2px 18px rgba(0,0,0,0.35)");

function Headline({ text, size, color, font, design, weight = 800, lineHeight = 1.05 }: { text: string; size: number; color: string; font: string; design: Design; weight?: 700 | 800; lineHeight?: number }) {
  const upper = isUpper(design);
  return (
    <div
      style={flex({
        fontFamily: font,
        fontWeight: weight,
        fontSize: size,
        lineHeight,
        color,
        letterSpacing: upper ? 1 : -1,
        textTransform: upper ? "uppercase" : "none",
        textAlign: design.align,
        justifyContent: design.align === "center" ? "center" : "flex-start",
      })}
    >
      {text}
    </div>
  );
}

/** Headline, subhead, a price line when the design sets the price as text, and the call to action. */
function Words({
  p,
  width,
  color,
  headSize,
  subSize,
  gap,
  headWeight = 800,
  shadow = "none",
}: {
  p: AdProps;
  width: number;
  color: string;
  headSize: number;
  subSize: number;
  gap: number;
  headWeight?: 700 | 800;
  shadow?: string;
}) {
  const { theme, design } = p;
  const center = design.align === "center";
  return (
    <div style={flex({ flexDirection: "column", width, gap, alignItems: center ? "center" : "flex-start", textShadow: shadow })}>
      <Headline text={p.headline} size={headSize} color={color} font={theme.fonts.heading} design={design} weight={headWeight} />
      {p.subhead && (
        <div style={flex({ fontFamily: theme.fonts.body, fontSize: subSize, lineHeight: 1.38, color, opacity: 0.9, textAlign: design.align, justifyContent: center ? "center" : "flex-start" })}>{p.subhead}</div>
      )}
      {p.badge && design.priceStyle === "line" && <PriceLine text={p.badge} color={color} font={theme.fonts.heading} size={subSize * 1.15} align={design.align} />}
      <div style={flex({ marginTop: gap * 0.3 })}>
        <CtaLine cta={p.cta} link={p.link} color={color} font={theme.fonts.body} size={subSize * 0.88} align={design.align} />
      </div>
    </div>
  );
}

/** Full photo; words over a soft shade on its calm side, the logo on the other. */
function Spotlight(p: AdProps) {
  const { canvas, theme, photo, design } = p;
  const unit = unitOf(canvas);
  const box = safeBox(canvas);
  const top = photo.zone === "top";
  const light = photo.zoneLight;
  const ink = light ? INK : "#ffffff";
  const width = canvas.width > canvas.height ? box.width * 0.6 : box.width;
  const head = fitText(p.headline, { maxWidth: width, maxHeight: canvas.height * 0.24, max: 108, min: 52, maxLines: 4, uppercase: isUpper(design) });
  const shade = top
    ? `linear-gradient(180deg, ${tint(light, 0.88)} 0%, ${tint(light, 0.55)} 30%, ${tint(light, 0)} 58%)`
    : `linear-gradient(180deg, ${tint(light, 0)} 36%, ${tint(light, 0.55)} 64%, ${tint(light, 0.9)} 100%)`;
  const logoLight = top ? photo.bottomLight : photo.topLight;
  const side = design.align === "center" ? "center" : "left";
  return (
    <div style={flex({ width: canvas.width, height: canvas.height, position: "relative", background: "#000" })}>
      <Photo src={p.photoUrl} width={canvas.width} height={canvas.height} focus={photo.focus} style={{ position: "absolute", top: 0, left: 0 }} />
      <div style={flex({ position: "absolute", top: 0, left: 0, width: canvas.width, height: canvas.height, background: shade })} />
      <div
        style={flex({
          position: "absolute",
          left: box.x,
          width: box.width,
          justifyContent: side === "center" ? "center" : "flex-start",
          ...(top ? { bottom: canvas.safe.bottom } : { top: canvas.safe.top }),
        })}
      >
        <Brand theme={theme} bg={logoLight ? "#ffffff" : "#000000"} height={62 * unit} maxWidth={300 * unit} color={logoLight ? INK : "#ffffff"} align={side} />
      </div>
      {p.badge && design.priceStyle !== "line" && (
        <div style={flex({ position: "absolute", right: canvas.safe.right, ...(top ? { bottom: canvas.safe.bottom + 90 * unit } : { top: canvas.safe.top - 10 }) })}>
          <FloatingPrice text={p.badge} style={design.priceStyle} pair={theme.accent} size={180 * unit} font={theme.fonts.heading} />
        </div>
      )}
      <div style={flex({ position: "absolute", left: box.x, width: box.width, justifyContent: design.align === "center" ? "center" : "flex-start", ...(top ? { top: canvas.safe.top } : { bottom: canvas.safe.bottom }) })}>
        <Words p={p} width={width} color={ink} headSize={head.size} subSize={34 * unit} gap={22 * unit} shadow={textShadow(light)} />
      </div>
    </div>
  );
}

/** Magazine cover: the logo as a masthead over a fine rule, a large title on the calm side, the call to action as a footer line. */
function Editorial(p: AdProps) {
  const { canvas, theme, photo } = p;
  const design: Design = { ...p.design, priceStyle: p.design.priceStyle === "circle" ? "line" : p.design.priceStyle };
  const unit = unitOf(canvas);
  const box = safeBox(canvas);
  const top = photo.zone === "top";
  const light = photo.zoneLight;
  const ink = light ? INK : "#ffffff";
  const center = design.align === "center";
  const head = fitText(p.headline, { maxWidth: box.width, maxHeight: canvas.height * 0.27, max: 128, min: 56, maxLines: 4, uppercase: isUpper(design) });
  // A light wash at the top for the masthead, and a deeper one behind the title
  const mastLight = top ? light : photo.topLight;
  const shade = top
    ? `linear-gradient(180deg, ${tint(light, 0.9)} 0%, ${tint(light, 0.6)} 34%, ${tint(light, 0)} 62%)`
    : `linear-gradient(180deg, ${tint(mastLight, 0.55)} 0%, ${tint(mastLight, 0)} 18%, ${tint(light, 0)} 42%, ${tint(light, 0.6)} 70%, ${tint(light, 0.92)} 100%)`;
  const mastInk = mastLight ? INK : "#ffffff";
  const sub = 32 * unit;
  return (
    <div style={flex({ width: canvas.width, height: canvas.height, position: "relative", background: "#000" })}>
      <Photo src={p.photoUrl} width={canvas.width} height={canvas.height} focus={photo.focus} style={{ position: "absolute", top: 0, left: 0 }} />
      <div style={flex({ position: "absolute", top: 0, left: 0, width: canvas.width, height: canvas.height, background: shade })} />
      <div style={flex({ position: "absolute", top: canvas.safe.top, left: box.x, width: box.width, flexDirection: "column", gap: 26 * unit, alignItems: center ? "center" : "flex-start" })}>
        <Brand theme={theme} bg={mastLight ? "#ffffff" : "#000000"} height={70 * unit} maxWidth={360 * unit} color={mastInk} align={center ? "center" : "left"} />
        <div style={flex({ width: box.width, height: Math.max(2, 2 * unit), background: mastInk, opacity: 0.55 })} />
        {top && (
          <div style={flex({ flexDirection: "column", gap: 18 * unit, alignItems: center ? "center" : "flex-start", width: box.width })}>
            <Headline text={p.headline} size={head.size} color={ink} font={theme.fonts.heading} design={design} weight={700} lineHeight={1.0} />
            {p.subhead && <div style={flex({ fontFamily: theme.fonts.body, fontSize: sub, lineHeight: 1.4, color: ink, opacity: 0.9, textAlign: design.align })}>{p.subhead}</div>}
          </div>
        )}
      </div>
      <div style={flex({ position: "absolute", bottom: canvas.safe.bottom, left: box.x, width: box.width, flexDirection: "column", gap: 20 * unit, alignItems: center ? "center" : "flex-start", textShadow: textShadow(light) })}>
        {!top && <Headline text={p.headline} size={head.size} color={ink} font={theme.fonts.heading} design={design} weight={700} lineHeight={1.0} />}
        {!top && p.subhead && <div style={flex({ fontFamily: theme.fonts.body, fontSize: sub, lineHeight: 1.4, color: ink, opacity: 0.9, textAlign: design.align })}>{p.subhead}</div>}
        <div style={flex({ width: box.width, height: Math.max(2, 2 * unit), background: top ? (photo.bottomLight ? INK : "#ffffff") : ink, opacity: 0.45, marginTop: 6 * unit })} />
        <div style={flex({ width: box.width, alignItems: "center", justifyContent: center ? "center" : "space-between", gap: 28 * unit })}>
          <CtaLine cta={p.cta} link={p.link} color={top ? (photo.bottomLight ? INK : "#ffffff") : ink} font={theme.fonts.body} size={28 * unit} align={center ? "center" : "left"} />
          {p.badge && design.priceStyle === "line" && !center && <div style={flex({ fontFamily: theme.fonts.heading, fontWeight: 700, fontSize: 38 * unit, color: top ? (photo.bottomLight ? INK : "#ffffff") : ink })}>{p.badge}</div>}
        </div>
      </div>
      {p.badge && (design.priceStyle === "tag" || center) && (
        <div style={flex({ position: "absolute", right: canvas.safe.right, top: canvas.height * (top ? 0.62 : 0.3) })}>
          <FloatingPrice text={p.badge} style="tag" pair={theme.accent} size={160 * unit} font={theme.fonts.heading} />
        </div>
      )}
    </div>
  );
}

/** Gallery print: the photo inset on a paper-coloured page, the words set calmly below it. */
function Poster(p: AdProps) {
  const { canvas, theme, photo, design } = p;
  const unit = unitOf(canvas);
  const paper = theme.light;
  const wide = canvas.width > canvas.height;
  const margin = Math.max(canvas.safe.left, 64 * unit);
  const top = canvas.safe.top;
  const center = design.align === "center";
  if (wide) {
    const photoW = canvas.width * 0.52;
    const textW = canvas.width - photoW - margin * 3;
    const head = fitText(p.headline, { maxWidth: textW, maxHeight: canvas.height * 0.36, max: 92, min: 46, maxLines: 4, uppercase: isUpper(design) });
    return (
      <div style={flex({ width: canvas.width, height: canvas.height, background: paper.bg, padding: margin, gap: margin, alignItems: "center", position: "relative" })}>
        <Photo src={p.photoUrl} width={photoW} height={canvas.height - margin * 2} focus={photo.focus} />
        <div style={flex({ flexDirection: "column", width: textW, gap: 26 * unit, alignItems: center ? "center" : "flex-start" })}>
          <Brand theme={theme} bg={paper.bg} height={54 * unit} maxWidth={260 * unit} color={paper.text} align={center ? "center" : "left"} />
          <Words p={p} width={textW} color={paper.text} headSize={head.size} subSize={30 * unit} gap={20 * unit} headWeight={700} />
        </div>
        {p.badge && design.priceStyle !== "line" && (
          <div style={flex({ position: "absolute", left: margin + photoW - 120 * unit, top: margin + 30 * unit })}>
            <FloatingPrice text={p.badge} style={design.priceStyle} pair={theme.accent} size={170 * unit} font={theme.fonts.heading} />
          </div>
        )}
      </div>
    );
  }
  const textW = canvas.width - margin * 2;
  const head = fitText(p.headline, { maxWidth: textW, maxHeight: canvas.height * 0.16, max: 84, min: 44, maxLines: 3, uppercase: isUpper(design) });
  const sub = 28 * unit;
  // The photo takes what the words leave, at most two thirds of the page
  const words = head.lines * head.size * 1.05 + (p.subhead ? sub * 1.4 * 2 : 0) + sub * 2.6 + (p.badge && design.priceStyle === "line" ? sub * 1.8 : 0) + 90 * unit;
  const photoH = Math.min(canvas.height * 0.66, canvas.height - top - canvas.safe.bottom - words);
  return (
    <div style={flex({ width: canvas.width, height: canvas.height, background: paper.bg, flexDirection: "column", padding: `${top}px ${margin}px ${canvas.safe.bottom}px`, gap: 34 * unit, position: "relative" })}>
      <Photo src={p.photoUrl} width={textW} height={photoH} focus={photo.focus} />
      <div style={flex({ flexDirection: "column", flex: 1, justifyContent: "space-between", alignItems: center ? "center" : "flex-start" })}>
        <Words p={p} width={textW} color={paper.text} headSize={head.size} subSize={sub} gap={16 * unit} headWeight={700} />
        <Brand theme={theme} bg={paper.bg} height={48 * unit} maxWidth={240 * unit} color={paper.text} align={center ? "center" : "left"} />
      </div>
      {p.badge && design.priceStyle !== "line" && (
        <div style={flex({ position: "absolute", right: margin + 24 * unit, top: top + photoH - 120 * unit })}>
          <FloatingPrice text={p.badge} style={design.priceStyle} pair={theme.accent} size={180 * unit} font={theme.fonts.heading} />
        </div>
      )}
    </div>
  );
}

/** Photo on one side, the words in a clean panel on the other. */
function Split(p: AdProps) {
  const { canvas, theme, photo, design } = p;
  const wide = canvas.width > canvas.height;
  const unit = unitOf(canvas);
  const photoShare = wide ? 0.52 : canvas.ratio === "9:16" ? 0.55 : 0.56;
  const panel = theme.light;
  const pw = wide ? canvas.width * photoShare : canvas.width;
  const ph = wide ? canvas.height : canvas.height * photoShare;
  const textW = (wide ? canvas.width - pw : canvas.width) - canvas.safe.left - canvas.safe.right;
  const textH = (wide ? canvas.height : canvas.height - ph) - canvas.safe.bottom - 80 * unit;
  const head = fitText(p.headline, { maxWidth: textW, maxHeight: textH * 0.5, max: 96, min: 46, maxLines: 4, uppercase: isUpper(design) });
  const center = design.align === "center";
  return (
    <div style={flex({ width: canvas.width, height: canvas.height, flexDirection: wide ? "row" : "column", background: panel.bg, position: "relative" })}>
      <Photo src={p.photoUrl} width={pw} height={ph} focus={photo.focus} />
      <div
        style={flex({
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          alignItems: center ? "center" : "flex-start",
          gap: 26 * unit,
          padding: `${44 * unit}px ${canvas.safe.right}px ${canvas.safe.bottom}px ${canvas.safe.left}px`,
        })}
      >
        <Words p={p} width={textW} color={panel.text} headSize={head.size} subSize={31 * unit} gap={20 * unit} />
        <Brand theme={theme} bg={panel.bg} height={46 * unit} maxWidth={220 * unit} color={panel.text} align={center ? "center" : "left"} />
      </div>
      {p.badge && design.priceStyle !== "line" && (
        <div style={flex({ position: "absolute", top: wide ? canvas.safe.top : ph - 110 * unit, left: wide ? pw - 110 * unit : canvas.width - canvas.safe.right - 190 * unit })}>
          <FloatingPrice text={p.badge} style={design.priceStyle} pair={theme.accent} size={190 * unit} font={theme.fonts.heading} />
        </div>
      )}
    </div>
  );
}

/** Brand-coloured canvas with the photo as a rounded card; the words above it, the call to action below. */
function Frame(p: AdProps) {
  const { canvas, theme, photo, design } = p;
  const unit = unitOf(canvas);
  const box = safeBox(canvas);
  const bg = theme.dark;
  const center = design.align === "center";
  const head = fitText(p.headline, { maxWidth: box.width, maxHeight: canvas.height * 0.2, max: 92, min: 46, maxLines: 3, uppercase: isUpper(design) });
  const subSize = 30 * unit;
  const sub = p.subhead ? fitText(p.subhead, { maxWidth: box.width, maxHeight: 400, max: subSize, min: subSize, weight: "regular", lineHeight: 1.4 }) : null;
  const gap = 26 * unit;
  const priceLine = p.badge && design.priceStyle === "line";
  // The photo card takes exactly the height left
  const used = 54 * unit + head.lines * head.size * 1.06 + (sub ? sub.lines * subSize * 1.4 + gap : 0) + subSize * 1.6 + (priceLine ? subSize * 1.6 + gap : 0) + gap * 4;
  const photoH = Math.max(200, canvas.height - canvas.safe.top - canvas.safe.bottom - used);
  return (
    <div style={flex({ width: canvas.width, height: canvas.height, flexDirection: "column", background: bg.bg, padding: `${canvas.safe.top}px ${canvas.safe.right}px ${canvas.safe.bottom}px ${canvas.safe.left}px`, gap })}>
      <div style={flex({ alignItems: "center", justifyContent: center ? "center" : "space-between", gap: 24 * unit })}>
        <Brand theme={theme} bg={bg.bg} height={54 * unit} maxWidth={240 * unit} color={bg.text} align={center ? "center" : "left"} />
        {!center && <div style={flex({ width: 90 * unit, height: 8 * unit, borderRadius: 8, background: theme.accent.bg })} />}
      </div>
      <Headline text={p.headline} size={head.size} color={bg.text} font={theme.fonts.heading} design={design} />
      {p.subhead && <div style={flex({ fontFamily: theme.fonts.body, fontSize: subSize, lineHeight: 1.4, color: bg.text, opacity: 0.82, textAlign: design.align, justifyContent: center ? "center" : "flex-start" })}>{p.subhead}</div>}
      <div style={flex({ position: "relative", width: box.width, height: photoH })}>
        <Photo src={p.photoUrl} width={box.width} height={photoH} radius={36 * unit} focus={photo.focus} />
        {p.badge && design.priceStyle !== "line" && (
          <div style={flex({ position: "absolute", top: -36 * unit, right: -16 * unit })}>
            <FloatingPrice text={p.badge} style={design.priceStyle} pair={theme.accent} size={170 * unit} font={theme.fonts.heading} />
          </div>
        )}
      </div>
      {priceLine && <PriceLine text={p.badge!} color={bg.text} font={theme.fonts.heading} size={subSize * 1.15} align={design.align} />}
      <CtaLine cta={p.cta} link={p.link} color={bg.text} font={theme.fonts.body} size={subSize * 0.95} align={design.align} />
    </div>
  );
}

/** Full photo with the headline set big inside a solid brand block: loud claims. */
function Bold(p: AdProps) {
  const { canvas, theme, photo, design } = p;
  const unit = unitOf(canvas);
  const box = safeBox(canvas);
  const blockW = Math.min(box.width, canvas.width * 0.86);
  const head = fitText(p.headline, { maxWidth: blockW - 80 * unit, maxHeight: canvas.height * 0.3, max: 100, min: 46, maxLines: 4, uppercase: true });
  const top = photo.zone === "top";
  const center = design.align === "center";
  const upperDesign: Design = { ...design, headlineCase: "upper" };
  return (
    <div style={flex({ width: canvas.width, height: canvas.height, position: "relative", background: "#000" })}>
      <Photo src={p.photoUrl} width={canvas.width} height={canvas.height} focus={photo.focus} style={{ position: "absolute", top: 0, left: 0 }} />
      <div style={flex({ position: "absolute", top: 0, left: 0, width: canvas.width, height: canvas.height, background: "linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.42))" })} />
      <div
        style={flex({
          position: "absolute",
          left: box.x,
          width: box.width,
          flexDirection: "column",
          gap: 20 * unit,
          alignItems: center ? "center" : "flex-start",
          ...(top ? { top: canvas.safe.top + 90 * unit } : { bottom: canvas.safe.bottom }),
        })}
      >
        <div style={flex({ width: blockW, background: theme.primary.bg, padding: `${34 * unit}px ${40 * unit}px`, borderRadius: 18 * unit, justifyContent: center ? "center" : "flex-start" })}>
          <Headline text={p.headline} size={head.size} color={theme.primary.text} font={theme.fonts.heading} design={upperDesign} lineHeight={1.02} />
        </div>
        {p.subhead && (
          <div style={flex({ background: theme.light.bg, color: theme.light.text, fontFamily: theme.fonts.body, fontSize: 30 * unit, lineHeight: 1.35, padding: `${18 * unit}px ${26 * unit}px`, borderRadius: 14 * unit })}>{p.subhead}</div>
        )}
        {p.badge && design.priceStyle === "line" && <PriceLine text={p.badge} color="#ffffff" font={theme.fonts.heading} size={40 * unit} align={design.align} />}
        <div style={flex({ textShadow: textShadow(false) })}>
          <CtaLine cta={p.cta} link={p.link} color="#ffffff" font={theme.fonts.body} size={30 * unit} align={design.align} />
        </div>
      </div>
      <div style={flex({ position: "absolute", right: canvas.safe.right, ...(top ? { bottom: canvas.safe.bottom } : { top: canvas.safe.top }) })}>
        <Brand theme={theme} bg={(top ? photo.bottomLight : photo.topLight) ? "#ffffff" : "#000000"} height={58 * unit} maxWidth={240 * unit} color="#ffffff" align="right" />
      </div>
      {p.badge && design.priceStyle !== "line" && (
        <div style={flex({ position: "absolute", left: canvas.safe.left, ...(top ? { bottom: canvas.safe.bottom } : { top: canvas.safe.top }) })}>
          <FloatingPrice text={p.badge} style={design.priceStyle} pair={theme.accent} size={180 * unit} font={theme.fonts.heading} />
        </div>
      )}
    </div>
  );
}

/** The price or the deal set very large beside the product: offers and promotions. */
function Offer(p: AdProps) {
  const { canvas, theme, photo, design } = p;
  const unit = unitOf(canvas);
  const wide = canvas.width > canvas.height;
  const panel = theme.accent;
  const pw = wide ? canvas.width * 0.5 : canvas.width;
  const ph = wide ? canvas.height : canvas.height * (canvas.ratio === "9:16" ? 0.5 : 0.52);
  const textW = (wide ? canvas.width - pw : canvas.width) - canvas.safe.left - canvas.safe.right;
  const center = design.align === "center";
  const price = p.badge ?? "";
  // Measured as wide capitals: the heading font is wider than the average the fit uses, and the price must stay on one line
  const priceFit = fitText(price, { maxWidth: textW, maxHeight: canvas.height * 0.18, max: 190, min: 40, maxLines: 1, uppercase: true });
  const head = fitText(p.headline, { maxWidth: textW, maxHeight: canvas.height * 0.13, max: 64, min: 36, maxLines: 3, uppercase: isUpper(design) });
  return (
    <div style={flex({ width: canvas.width, height: canvas.height, flexDirection: wide ? "row" : "column", background: panel.bg })}>
      <Photo src={p.photoUrl} width={pw} height={ph} focus={photo.focus} />
      <div
        style={flex({
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          alignItems: center ? "center" : "flex-start",
          gap: 18 * unit,
          padding: `${40 * unit}px ${canvas.safe.right}px ${canvas.safe.bottom}px ${canvas.safe.left}px`,
          color: panel.text,
        })}
      >
        <Headline text={p.headline} size={head.size} color={panel.text} font={theme.fonts.heading} design={design} weight={700} />
        {price && <div style={flex({ fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: priceFit.size, lineHeight: 1, letterSpacing: -2, whiteSpace: "nowrap" })}>{price}</div>}
        {p.subhead && <div style={flex({ fontFamily: theme.fonts.body, fontSize: 28 * unit, lineHeight: 1.38, opacity: 0.9, textAlign: design.align })}>{p.subhead}</div>}
        <div style={flex({ width: textW, alignItems: "center", justifyContent: center ? "center" : "space-between", gap: 24 * unit, marginTop: 8 * unit })}>
          <CtaLine cta={p.cta} link={p.link} color={panel.text} font={theme.fonts.body} size={28 * unit} align={design.align} />
          {!center && <Brand theme={theme} bg={panel.bg} height={44 * unit} maxWidth={200 * unit} color={panel.text} align="right" />}
        </div>
      </div>
    </div>
  );
}

/** A customer's words set large as a quote, the photo small beside them: reviews. */
function Quote(p: AdProps) {
  const { canvas, theme, photo, design } = p;
  const unit = unitOf(canvas);
  const box = safeBox(canvas);
  const page = theme.light;
  const center = design.align === "center";
  const wide = canvas.width > canvas.height;
  const cardW = wide ? canvas.height * 0.62 : box.width * 0.46;
  const cardH = cardW * 1.2;
  const quoteW = wide ? box.width - cardW - 60 * unit : box.width;
  const head = fitText(p.headline, { maxWidth: quoteW, maxHeight: canvas.height * (wide ? 0.42 : 0.3), max: 76, min: 40, maxLines: 6 });
  return (
    <div style={flex({ width: canvas.width, height: canvas.height, background: page.bg, padding: `${canvas.safe.top}px ${canvas.safe.right}px ${canvas.safe.bottom}px ${canvas.safe.left}px`, flexDirection: wide ? "row" : "column", gap: 44 * unit, alignItems: center && !wide ? "center" : "flex-start" })}>
      <div style={flex({ flexDirection: "column", width: quoteW, gap: 22 * unit, alignItems: center ? "center" : "flex-start", justifyContent: "center", ...(wide ? {} : { flex: 1 }) })}>
        <div style={flex({ fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: 200 * unit, lineHeight: 0.6, color: theme.accent.bg, height: 110 * unit })}>“</div>
        <Headline text={p.headline} size={head.size} color={page.text} font={theme.fonts.heading} design={{ ...design, headlineCase: "normal" }} weight={700} lineHeight={1.18} />
        {p.subhead && <div style={flex({ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 30 * unit, color: page.text, opacity: 0.75 })}>{`— ${p.subhead.replace(/^[-—–\s]+/, "")}`}</div>}
      </div>
      <div style={flex({ flexDirection: wide ? "column" : "row", alignItems: wide ? "flex-start" : "flex-end", justifyContent: "space-between", width: wide ? cardW : box.width, gap: 30 * unit, ...(wide ? { height: box.height } : {}) })}>
        <Photo src={p.photoUrl} width={cardW} height={cardH} radius={28 * unit} focus={photo.focus} />
        <div style={flex({ flexDirection: "column", gap: 18 * unit, alignItems: wide ? "flex-start" : "flex-end" })}>
          {p.badge && <PriceLine text={p.badge} color={page.text} font={theme.fonts.heading} size={34 * unit} />}
          <CtaLine cta={p.cta} link={p.link} color={page.text} font={theme.fonts.body} size={26 * unit} />
          <Brand theme={theme} bg={page.bg} height={46 * unit} maxWidth={220 * unit} color={page.text} align={wide ? "left" : "right"} />
        </div>
      </div>
    </div>
  );
}

export const AD_TEMPLATES: Record<TemplateId, (p: AdProps) => React.ReactElement> = {
  spotlight: Spotlight,
  editorial: Editorial,
  poster: Poster,
  split: Split,
  frame: Frame,
  bold: Bold,
  offer: Offer,
  quote: Quote,
};
