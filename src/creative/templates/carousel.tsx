import { contrast } from "@/lib/color";
import { fitText } from "../fit";
import { safeBox, type Canvas } from "../sizes";
import type { CreativeTheme } from "../theme";
import { Brand, CtaPill, flex, Photo } from "./parts";

// Carousel slides: a hook cover on a photo, numbered content slides, and a call-to-action slide.

interface SlideBase {
  canvas: Canvas;
  theme: CreativeTheme;
  index: number;
  total: number;
}

function Dots({ index, total, color, unit }: { index: number; total: number; color: string; unit: number }) {
  return (
    <div style={flex({ gap: 10 * unit, alignItems: "center" })}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={flex({ width: (i === index ? 34 : 12) * unit, height: 12 * unit, borderRadius: 12, background: color, opacity: i === index ? 1 : 0.35 })} />
      ))}
    </div>
  );
}

export function CoverSlide({ canvas, theme, index, total, photoUrl, title }: SlideBase & { photoUrl: string; title: string }) {
  const unit = canvas.width / 1080;
  const box = safeBox(canvas);
  const head = fitText(title, { maxWidth: box.width, maxHeight: canvas.height * 0.32, max: 118, min: 58, maxLines: 5 });
  return (
    <div style={flex({ width: canvas.width, height: canvas.height, position: "relative", background: theme.dark.bg })}>
      <Photo src={photoUrl} width={canvas.width} height={canvas.height} style={{ position: "absolute", top: 0, left: 0 }} />
      <div
        style={flex({
          position: "absolute",
          top: 0,
          left: 0,
          width: canvas.width,
          height: canvas.height,
          background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,0.92) 100%)",
        })}
      />
      <div style={flex({ position: "absolute", top: canvas.safe.top, left: canvas.safe.left })}>
        <Brand theme={theme} bg="#000000" height={56 * unit} maxWidth={260 * unit} color="#ffffff" />
      </div>
      <div style={flex({ position: "absolute", left: box.x, bottom: canvas.safe.bottom, width: box.width, flexDirection: "column", gap: 34 * unit })}>
        <div style={flex({ fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: head.size, lineHeight: 1.04, color: "#ffffff", letterSpacing: -1.5 })}>{title}</div>
        <div style={flex({ alignItems: "center", justifyContent: "space-between" })}>
          <Dots index={index} total={total} color="#ffffff" unit={unit} />
          <div style={flex({ alignItems: "center", gap: 12 * unit, color: "#ffffff", fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 30 * unit })}>
            Swipe <span style={{ fontSize: 38 * unit }}>→</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContentSlide({ canvas, theme, index, total, title, body }: SlideBase & { title: string; body: string }) {
  const unit = canvas.width / 1080;
  const box = safeBox(canvas);
  const surface = index % 2 === 1 ? theme.light : theme.dark;
  const head = fitText(title, { maxWidth: box.width, maxHeight: canvas.height * 0.26, max: 84, min: 44, maxLines: 4 });
  const text = body ? fitText(body, { maxWidth: box.width, maxHeight: canvas.height * 0.34, max: 44, min: 28, weight: "regular", lineHeight: 1.45 }) : null;
  return (
    <div
      style={flex({
        width: canvas.width,
        height: canvas.height,
        flexDirection: "column",
        background: surface.bg,
        padding: `${canvas.safe.top}px ${canvas.safe.right}px ${canvas.safe.bottom}px ${canvas.safe.left}px`,
      })}
    >
      <div style={flex({ alignItems: "center", justifyContent: "space-between" })}>
        <div style={flex({ fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: 120 * unit, lineHeight: 1, color: contrast(theme.accent.bg, surface.bg) >= 3 ? theme.accent.bg : surface.text })}>
          {String(index).padStart(2, "0")}
        </div>
        <Brand theme={theme} bg={surface.bg} height={46 * unit} maxWidth={200 * unit} color={surface.text} />
      </div>
      <div style={flex({ flex: 1, flexDirection: "column", justifyContent: "center", gap: 30 * unit })}>
        <div style={flex({ fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: head.size, lineHeight: 1.08, color: surface.text, letterSpacing: -1 })}>{title}</div>
        {text && <div style={flex({ fontFamily: theme.fonts.body, fontSize: text.size, lineHeight: 1.45, color: surface.text, opacity: 0.85 })}>{body}</div>}
      </div>
      <Dots index={index} total={total} color={surface.text} unit={unit} />
    </div>
  );
}

export function CtaSlide({ canvas, theme, index, total, title, body, cta }: SlideBase & { title: string; body: string; cta: string }) {
  const unit = canvas.width / 1080;
  const box = safeBox(canvas);
  const surface = theme.primary;
  const head = fitText(title, { maxWidth: box.width, maxHeight: canvas.height * 0.28, max: 96, min: 48, maxLines: 4 });
  return (
    <div
      style={flex({
        width: canvas.width,
        height: canvas.height,
        flexDirection: "column",
        background: surface.bg,
        padding: `${canvas.safe.top}px ${canvas.safe.right}px ${canvas.safe.bottom}px ${canvas.safe.left}px`,
        justifyContent: "space-between",
      })}
    >
      <Brand theme={theme} bg={surface.bg} height={64 * unit} maxWidth={300 * unit} color={surface.text} />
      <div style={flex({ flexDirection: "column", gap: 30 * unit })}>
        <div style={flex({ fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: head.size, lineHeight: 1.06, color: surface.text, letterSpacing: -1 })}>{title}</div>
        {body && <div style={flex({ fontFamily: theme.fonts.body, fontSize: 38 * unit, lineHeight: 1.4, color: surface.text, opacity: 0.88 })}>{body}</div>}
        <div style={flex({ marginTop: 12 * unit })}>
          <CtaPill label={cta} pair={surface.text === "#ffffff" ? theme.light : theme.dark} size={36 * unit} font={theme.fonts.body} />
        </div>
      </div>
      <Dots index={index} total={total} color={surface.text} unit={unit} />
    </div>
  );
}

/** Closing frame of a video: logo, call to action and the business name. */
export function EndCard({ canvas, theme, cta, line }: { canvas: Canvas; theme: CreativeTheme; cta: string; line: string | null }) {
  const unit = Math.min(canvas.width, canvas.height) / 1080;
  const surface = theme.dark;
  return (
    <div
      style={flex({
        width: canvas.width,
        height: canvas.height,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 46 * unit,
        background: surface.bg,
        padding: canvas.safe.left,
      })}
    >
      <Brand theme={theme} bg={surface.bg} height={150 * unit} maxWidth={620 * unit} color={surface.text} />
      {line && (
        <div style={flex({ fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: 64 * unit, lineHeight: 1.1, color: surface.text, textAlign: "center", maxWidth: canvas.width * 0.8 })}>
          {line}
        </div>
      )}
      <CtaPill label={cta} pair={theme.accent} size={42 * unit} font={theme.fonts.body} />
    </div>
  );
}
