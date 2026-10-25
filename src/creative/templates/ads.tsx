import type { TemplateId } from "@/core/creative/brief";
import { fitText } from "../fit";
import { safeBox, type Canvas } from "../sizes";
import type { CreativeTheme } from "../theme";
import { Badge, Brand, CtaPill, flex, Photo } from "./parts";

// Four static ad layouts. Each works at 1:1, 4:5, 9:16 and 16:9: sizes come from the canvas and the
// safe zone, and text is sized to fit its box. Text colours come only from contrast-checked pairs.

export interface AdProps {
  canvas: Canvas;
  theme: CreativeTheme;
  photoUrl: string;
  headline: string;
  subhead: string | null;
  cta: string;
  badge: string | null;
}

const SCRIM = "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.1) 35%, rgba(0,0,0,0.78) 72%, rgba(0,0,0,0.9) 100%)";

/** Full-bleed photo; headline, subhead and button over a dark fade at the bottom. */
function Spotlight({ canvas, theme, photoUrl, headline, subhead, cta, badge }: AdProps) {
  const box = safeBox(canvas);
  const head = fitText(headline, { maxWidth: box.width, maxHeight: canvas.height * 0.26, max: 112, min: 54, maxLines: 4 });
  const unit = canvas.width / 1080;
  return (
    <div style={flex({ width: canvas.width, height: canvas.height, position: "relative", background: theme.dark.bg })}>
      <Photo src={photoUrl} width={canvas.width} height={canvas.height} style={{ position: "absolute", top: 0, left: 0 }} />
      <div style={flex({ position: "absolute", top: 0, left: 0, width: canvas.width, height: canvas.height, background: SCRIM })} />
      <div style={flex({ position: "absolute", top: canvas.safe.top, left: canvas.safe.left })}>
        <Brand theme={theme} bg="#000000" height={64 * unit} maxWidth={300 * unit} color="#ffffff" />
      </div>
      {badge && (
        <div style={flex({ position: "absolute", top: canvas.safe.top - 10, right: canvas.safe.right })}>
          <Badge text={badge} pair={theme.accent} size={190 * unit} font={theme.fonts.heading} />
        </div>
      )}
      <div
        style={flex({
          position: "absolute",
          left: box.x,
          bottom: canvas.safe.bottom,
          width: box.width,
          flexDirection: "column",
          gap: 26 * unit,
        })}
      >
        <div style={flex({ fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: head.size, lineHeight: 1.05, color: "#ffffff", letterSpacing: -1 })}>{headline}</div>
        {subhead && <div style={flex({ fontFamily: theme.fonts.body, fontSize: 36 * unit, lineHeight: 1.35, color: "rgba(255,255,255,0.9)" })}>{subhead}</div>}
        <div style={flex({ marginTop: 8 * unit })}>
          <CtaPill label={cta} pair={theme.primary} size={34 * unit} font={theme.fonts.body} />
        </div>
      </div>
    </div>
  );
}

/** Photo on top, a brand-coloured panel with the words below. */
function Split({ canvas, theme, photoUrl, headline, subhead, cta, badge }: AdProps) {
  const wide = canvas.width > canvas.height;
  const unit = Math.min(canvas.width, canvas.height) / 1080;
  const photoShare = wide ? 0.52 : canvas.ratio === "9:16" ? 0.55 : 0.56;
  const panel = theme.light;
  const pw = wide ? canvas.width * photoShare : canvas.width;
  const ph = wide ? canvas.height : canvas.height * photoShare;
  const textW = (wide ? canvas.width - pw : canvas.width) - canvas.safe.left - canvas.safe.right;
  const textH = (wide ? canvas.height : canvas.height - ph) - canvas.safe.bottom - 80 * unit;
  const head = fitText(headline, { maxWidth: textW, maxHeight: textH * 0.5, max: 96, min: 48, maxLines: 4 });
  return (
    <div style={flex({ width: canvas.width, height: canvas.height, flexDirection: wide ? "row" : "column", background: panel.bg, position: "relative" })}>
      <Photo src={photoUrl} width={pw} height={ph} />
      <div
        style={flex({
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          gap: 22 * unit,
          padding: `${48 * unit}px ${canvas.safe.right}px ${canvas.safe.bottom}px ${canvas.safe.left}px`,
        })}
      >
        <div style={flex({ fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: head.size, lineHeight: 1.06, color: panel.text, letterSpacing: -1 })}>{headline}</div>
        {subhead && <div style={flex({ fontFamily: theme.fonts.body, fontSize: 32 * unit, lineHeight: 1.4, color: panel.text, opacity: 0.82 })}>{subhead}</div>}
        <div style={flex({ alignItems: "center", justifyContent: "space-between", marginTop: 10 * unit })}>
          <CtaPill label={cta} pair={theme.primary} size={30 * unit} font={theme.fonts.body} />
          <Brand theme={theme} bg={panel.bg} height={54 * unit} maxWidth={220 * unit} color={panel.text} />
        </div>
      </div>
      {badge && (
        <div style={flex({ position: "absolute", top: wide ? canvas.safe.top : ph - 120 * unit, left: wide ? pw - 110 * unit : canvas.width - canvas.safe.right - 200 * unit })}>
          <Badge text={badge} pair={theme.accent} size={200 * unit} font={theme.fonts.heading} />
        </div>
      )}
    </div>
  );
}

/** Dark brand canvas with the photo as a rounded card; headline above it. */
function Frame({ canvas, theme, photoUrl, headline, subhead, cta, badge }: AdProps) {
  const unit = Math.min(canvas.width, canvas.height) / 1080;
  const box = safeBox(canvas);
  const bg = theme.dark;
  const head = fitText(headline, { maxWidth: box.width, maxHeight: canvas.height * 0.2, max: 92, min: 46, maxLines: 3 });
  const subSize = 30 * unit;
  const sub = subhead ? fitText(subhead, { maxWidth: box.width, maxHeight: 400, max: subSize, min: subSize, weight: "regular", lineHeight: 1.4 }) : null;
  const gap = 26 * unit;
  // The photo card takes exactly the height left, so the button sits on it
  const used = 54 * unit + head.lines * head.size * 1.06 + (sub ? sub.lines * subSize * 1.4 + gap : 0) + gap * 2;
  const photoH = Math.max(200, canvas.height - canvas.safe.top - canvas.safe.bottom - used);
  return (
    <div style={flex({ width: canvas.width, height: canvas.height, flexDirection: "column", background: bg.bg, padding: `${canvas.safe.top}px ${canvas.safe.right}px ${canvas.safe.bottom}px ${canvas.safe.left}px`, gap: 26 * unit })}>
      <div style={flex({ alignItems: "center", justifyContent: "space-between" })}>
        <Brand theme={theme} bg={bg.bg} height={54 * unit} maxWidth={240 * unit} color={bg.text} />
        <div style={flex({ width: 90 * unit, height: 8 * unit, borderRadius: 8, background: theme.accent.bg })} />
      </div>
      <div style={flex({ fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: head.size, lineHeight: 1.06, color: bg.text, letterSpacing: -1 })}>{headline}</div>
      {subhead && <div style={flex({ fontFamily: theme.fonts.body, fontSize: subSize, lineHeight: 1.4, color: bg.text, opacity: 0.8 })}>{subhead}</div>}
      <div style={flex({ position: "relative", width: box.width, height: photoH })}>
        <Photo src={photoUrl} width={box.width} height={photoH} radius={36 * unit} />
        {badge && (
          <div style={flex({ position: "absolute", top: -40 * unit, right: -20 * unit })}>
            <Badge text={badge} pair={theme.accent} size={180 * unit} font={theme.fonts.heading} />
          </div>
        )}
        <div style={flex({ position: "absolute", bottom: 28 * unit, left: 28 * unit })}>
          <CtaPill label={cta} pair={theme.primary} size={30 * unit} font={theme.fonts.body} />
        </div>
      </div>
    </div>
  );
}

/** Full-bleed photo, headline set big inside a solid brand block. */
function Bold({ canvas, theme, photoUrl, headline, subhead, cta, badge }: AdProps) {
  const unit = Math.min(canvas.width, canvas.height) / 1080;
  const box = safeBox(canvas);
  const blockW = Math.min(box.width, canvas.width * 0.86);
  const head = fitText(headline.toUpperCase(), { maxWidth: blockW - 80 * unit, maxHeight: canvas.height * 0.3, max: 100, min: 46, maxLines: 4, uppercase: true });
  return (
    <div style={flex({ width: canvas.width, height: canvas.height, position: "relative", background: theme.dark.bg })}>
      <Photo src={photoUrl} width={canvas.width} height={canvas.height} style={{ position: "absolute", top: 0, left: 0 }} />
      <div style={flex({ position: "absolute", top: 0, left: 0, width: canvas.width, height: canvas.height, background: "linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.45))" })} />
      <div style={flex({ position: "absolute", left: box.x, bottom: canvas.safe.bottom, flexDirection: "column", gap: 20 * unit, width: blockW })}>
        <div
          style={flex({
            background: theme.primary.bg,
            color: theme.primary.text,
            fontFamily: theme.fonts.heading,
            fontWeight: 800,
            fontSize: head.size,
            lineHeight: 1.02,
            letterSpacing: -0.5,
            padding: `${34 * unit}px ${40 * unit}px`,
            borderRadius: 18 * unit,
            textTransform: "uppercase",
          })}
        >
          {headline}
        </div>
        {subhead && (
          <div style={flex({ background: theme.light.bg, color: theme.light.text, fontFamily: theme.fonts.body, fontSize: 30 * unit, lineHeight: 1.35, padding: `${18 * unit}px ${26 * unit}px`, borderRadius: 14 * unit })}>
            {subhead}
          </div>
        )}
        <div style={flex({ alignItems: "center", justifyContent: "space-between" })}>
          <CtaPill label={cta} pair={theme.accent} size={30 * unit} font={theme.fonts.body} />
        </div>
      </div>
      <div style={flex({ position: "absolute", top: canvas.safe.top, right: canvas.safe.right })}>
        <Brand theme={theme} bg="#000000" height={58 * unit} maxWidth={240 * unit} color="#ffffff" />
      </div>
      {badge && (
        <div style={flex({ position: "absolute", top: canvas.safe.top, left: canvas.safe.left })}>
          <Badge text={badge} pair={theme.accent} size={180 * unit} font={theme.fonts.heading} />
        </div>
      )}
    </div>
  );
}

export const AD_TEMPLATES: Record<TemplateId, (p: AdProps) => React.ReactElement> = {
  spotlight: Spotlight,
  split: Split,
  frame: Frame,
  bold: Bold,
};

export const TEMPLATE_NOTES: Record<TemplateId, string> = {
  spotlight: "full photo, words at the bottom over a dark fade: best for strong lifestyle or product photos",
  split: "photo on top, words in a clean brand panel below: best for clear offers and explanations",
  frame: "dark brand canvas with the photo as a card: premium, editorial feel",
  bold: "full photo with the headline in a solid brand block: loud, scroll-stopping claims",
};
