import { ai } from "@/providers/ai/registry";
import type { Usage } from "@/providers/usage";
import { collectCss } from "./css";

// The website's design language: screenshots of the homepage and two of its key pages (what the pages look
// like: components, motifs, layout) and, from the code, how they move (animation libraries, keyframes,
// transition timing, scroll reveals). Code reads the motion; the vision call describes the rest.

/** Pages to look at: the homepage and this many more */
const MORE_PAGES = 2;

/** Paths that show the brand at its best, most telling first; pages that say little about the design are skipped */
const TELLING = [/case|work|portfolio|project|showcase/i, /service|solution|what-we-do|capabilit|offer/i, /product|shop|collection|menu/i, /about|story|vision/i];
const SKIP = /privacy|terms|legal|cookie|policy|login|sign-?in|sign-?up|cart|checkout|account|careers?|jobs|contact|blog\/.|news\/.|\.(pdf|jpg|png|svg|zip)$/i;

/** The homepage's own links to its key pages, best first. */
export function keyPages(html: string, homepage: string, max = MORE_PAGES): string[] {
  let home: URL;
  try {
    home = new URL(homepage);
  } catch {
    return [];
  }
  const seen = new Set<string>([home.pathname.replace(/\/$/, "") || "/"]);
  const pages: { url: string; rank: number; depth: number }[] = [];
  for (const m of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)) {
    let url: URL;
    try {
      url = new URL(m[1].replace(/&amp;/g, "&"), home);
    } catch {
      continue;
    }
    const path = url.pathname.replace(/\/$/, "") || "/";
    if (url.hostname.replace(/^www\./, "") !== home.hostname.replace(/^www\./, "") || seen.has(path) || SKIP.test(path)) continue;
    seen.add(path);
    const rank = TELLING.findIndex((p) => p.test(path));
    if (rank >= 0) pages.push({ url: `${url.origin}${path}`, rank, depth: path.split("/").length });
  }
  // The best kind of page first, a section page before one deep inside it, and each kind at most once when possible
  pages.sort((a, b) => a.rank - b.rank || a.depth - b.depth);
  const picked: typeof pages = [];
  for (const p of pages) if (picked.length < max && !picked.some((q) => q.rank === p.rank)) picked.push(p);
  for (const p of pages) if (picked.length < max && !picked.includes(p)) picked.push(p);
  return picked.map((p) => p.url);
}

const LIBRARIES: [RegExp, string][] = [
  [/gsap|scrolltrigger/i, "GSAP"],
  [/framer-motion|data-framer|framerusercontent/i, "Framer Motion"],
  [/lenis|locomotive-scroll/i, "smooth scrolling"],
  [/lottie/i, "Lottie animations"],
  [/three(\.module)?\.js|@react-three|webgl/i, "3D (WebGL)"],
  [/swiper|splide|embla|keen-slider/i, "sliders"],
  [/data-aos|aos\.js/i, "scroll animations (AOS)"],
  [/splittype|split-type|splitting\.js/i, "letter-by-letter text animations"],
  [/barba|swup/i, "animated page transitions"],
  [/spline\.design|splinetool/i, "3D scenes (Spline)"],
];

/** How the site moves, read from its HTML and CSS: a few plain lines, or null when nothing moves. */
export function readMotion(html: string, css: string): string | null {
  const lines: string[] = [];

  const libraries = [...new Set(LIBRARIES.filter(([pattern]) => pattern.test(html)).map(([, name]) => name))];
  if (libraries.length) lines.push(`Uses ${libraries.join(", ")}.`);

  // Named animations, without the CSS framework's own (spin, ping, pulse, bounce are Tailwind's loaders)
  const names = [...new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]))];
  const own = names.filter((n) => !/^(spin|ping|pulse|bounce|enter|exit|accordion-(up|down)|caret-blink|fade-?in|fade-?out)$/i.test(n));
  if (names.length) lines.push(`${names.length} keyframe animation${names.length === 1 ? "" : "s"}${own.length ? ` (${own.slice(0, 8).join(", ")})` : ""}.`);

  // Transition and animation timing: the typical duration and easing
  const durations = [...css.matchAll(/(?:transition|animation)(?:-duration)?\s*:[^;}]*?(\d*\.?\d+)(m?s)\b/g)]
    .map((m) => Number(m[1]) * (m[2] === "s" ? 1000 : 1))
    .filter((ms) => ms > 0 && ms <= 10_000)
    .sort((a, b) => a - b);
  if (durations.length >= 3) {
    const typical = durations[Math.floor(durations.length / 2)];
    lines.push(`Transitions typically ${Math.round(typical)} ms (${durations.length} timed transitions or animations).`);
  }
  const easings = [...css.matchAll(/cubic-bezier\([^)]*\)|\bease-in-out\b|\bease-out\b|\bease-in\b|\blinear\b(?=[\s;,)])/g)].map((m) => m[0].replace(/\s+/g, ""));
  if (easings.length) {
    const counts = new Map<string, number>();
    for (const e of easings) counts.set(e, (counts.get(e) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    lines.push(`Most common easing: ${top}.`);
  }

  // Elements that start hidden and slide or fade in (scroll reveals), and hover effects that move things
  const reveals = [...html.matchAll(/style="[^"]*opacity:\s*0[^"]*transform:[^"]*"/gi)].length;
  if (reveals >= 3) lines.push(`${reveals} elements start hidden and slide or fade in as you scroll.`);
  const hovers = [...css.matchAll(/:hover[^{]*\{[^}]*(?:transform|scale|translate|rotate)/g)].length;
  if (hovers >= 3) lines.push(`${hovers} hover effects that move, scale or tilt elements.`);
  if (/@media[^{]*prefers-reduced-motion/i.test(css)) lines.push("Respects reduced motion settings.");

  return lines.length ? lines.join(" ") : null;
}

export interface SiteDesignRead {
  /** Screenshots of the pages, homepage first (Firecrawl's links, for the vision call right after) */
  screenshots: string[];
  /** How the site moves, from its code */
  motion: string | null;
  pages: string[];
  usage: Usage[];
}

/** Reads the homepage and its key pages: a screenshot of each, and the motion from the code. 1 Firecrawl credit a page. */
export async function readSiteDesign(website: string): Promise<SiteDesignRead> {
  const usage: Usage[] = [];
  const home = await ai.crawl.scrape(website, { design: true });
  usage.push(home.usage);
  const html = home.data.rawHtml ?? "";
  const { css } = await collectCss(html, website);
  const pages = keyPages(html, website);

  const screenshots = home.data.screenshotUrl ? [home.data.screenshotUrl] : [];
  let allHtml = html;
  // A page that can't be read is only one picture fewer
  const more = await Promise.all(pages.map((url) => ai.crawl.scrape(url, { design: true }).catch(() => null)));
  for (const page of more) {
    if (!page) continue;
    usage.push(page.usage);
    if (page.data.screenshotUrl) screenshots.push(page.data.screenshotUrl);
    allHtml += page.data.rawHtml ?? "";
  }
  return { screenshots, motion: readMotion(allHtml, css), pages: [website, ...pages], usage };
}
