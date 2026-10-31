// Offline checks of the video system's rules (no vendor calls, no database): the storyline and scene
// checks, how brief labels become the client's photos and video moments, the look for a brand, and
// the timeline the renderer draws (timing, captions, placement, sound).
// Run: npm run smoke scripts/check/video-logic.ts
import assert from "node:assert/strict";
import { FPS } from "@video/timeline";
import { PRESETS } from "@video/presets";
import { assembleBrief } from "@/agents/creative-director/assemble";
import { checkBrief } from "@/agents/creative-director/checks";
import type { FactBook } from "@/agents/creative-director/book";
import type { CreativeContext } from "@/agents/creative-director/context";
import { videoPlan } from "@/agents/creative-director/video-book";
import type { Moment } from "@/core/brand/footage";
import { contentRules } from "@/core/content/prefs";
import { stylesFor, videoSound } from "@/core/content/styles";
import type { VideoBrief } from "@/core/creative/brief";
import type { PlanItem } from "@/core/plans/types";
import { buildTimeline, besideSubject, motionFor, zonesFor, type BuildScene } from "@/creative/video/timeline";
import { choosePreset } from "@/creative/video/preset";
import { linkText, momentLayout, priceText, videoCanvas } from "@/creative/video/parts";
import { rawBriefSchema } from "@/prompts/agents/creative-brief";

let passed = 0;
const check = (name: string, fn: () => void | Promise<void>) =>
  Promise.resolve()
    .then(fn)
    .then(
      () => {
        passed++;
        console.log(`ok   ${name}`);
      },
      (e) => {
        console.error(`FAIL ${name}\n     ${e instanceof Error ? e.message : e}`);
        process.exitCode = 1;
      }
    );

// ---------- Styles, sound and look ----------

await check("videoSound: talking styles need talking footage, else a voice-over explainer", () => {
  assert.equal(videoSound("talking", false), "voice_music");
  assert.equal(videoSound("talking", true), "speech");
  assert.equal(videoSound("showcase"), "music");
  assert.equal(videoSound("bts"), "music"); // natural sound needs real footage
  assert.deepEqual(stylesFor("video", { image: [], video: ["ugc", "howto"] }, "real", true), ["ugc", "howto"]);
  assert.deepEqual(stylesFor("video", { image: [], video: ["ugc", "howto"] }, "real", false), ["faceless", "howto"]);
});

await check("choosePreset: the brand's tone and industry decide the look, the same way every time", () => {
  assert.equal(choosePreset({ playful: 80, formal: 30 }, "food", "faceless"), "playful");
  assert.equal(choosePreset({ formal: 75, technical: 70 }, "finance", "howto"), "corporate");
  assert.equal(choosePreset({ bold: 80 }, "fitness", "faceless"), "bold");
  assert.equal(choosePreset({ bold: 40 }, "fashion", "showcase"), "editorial");
  assert.equal(choosePreset({}, null, "faceless"), "minimal");
  assert.equal(choosePreset({ bold: 80 }, "fitness", "faceless"), choosePreset({ bold: 80 }, "fitness", "faceless"));
});

// ---------- Creative Director: labels → real footage, facts, storyline ----------

const moment = (over: Partial<Moment>): Moment => ({
  start: 2,
  end: 8,
  shows: "close-up of hands finishing a ring",
  shot: "close-up",
  people: "hands",
  talking: false,
  product: true,
  quality: 4,
  use: "broll",
  subject: { x: "center", y: "middle" },
  textArea: "bottom",
  lines: [],
  assetId: "00000000-0000-4000-8000-0000000000a1",
  offeringId: null,
  orientation: "vertical",
  storageKey: "b/brand/videos/a1.mp4",
  ...over,
});
const talkingMoment = moment({ start: 10, end: 30, talking: true, people: "person", use: "testimonial", assetId: "00000000-0000-4000-8000-0000000000a2", lines: [{ start: 10.5, end: 13, text: "I wear it every day" }] });
const proofId = "00000000-0000-4000-8000-0000000000b1";
const baseItem = { id: "i1", platforms: ["instagram"], format: "video", style: "showcase", offering_id: "o1" } as unknown as PlanItem;
const ctxFor = (style: string, moments: Moment[] = [moment({})]): CreativeContext =>
  ({
    item: { ...baseItem, style },
    rules: contentRules({ music_mood: "calm" }),
    ctaLinks: { website: "https://acme.com" },
    avoidWords: [],
    bible: { neverSay: [] },
    offer: null,
    offering: { id: "o1", name: "Ring", price: 89, currency: "EUR", priceModel: "fixed", description: "", benefits: [], objections: [] },
    proof: [{ id: proofId, kind: "review", content: "Rated 4.9 by 120 customers", author: "Ana", rating: 5 }],
    passages: [],
    assets: [],
    moments,
    lessons: [],
    tone: { bold: 40 },
    industry: "fashion",
  }) as unknown as CreativeContext;
const bookFor = (ctx: CreativeContext): FactBook => {
  const labels = new Map(ctx.moments.map((m, i) => [`V${i + 1}`, m]));
  return {
    text: "",
    ref: (l) => ({ O1: "offering:o1", R1: `proof:${proofId}` })[String(l ?? "").replace(/^\[|\]$/g, "").toUpperCase()] ?? null,
    asset: (l) => (l === "G1" ? "00000000-0000-4000-8000-000000000001" : null),
    priceLabels: new Set(["O1"]),
    moment: (l) => labels.get(String(l ?? "").toUpperCase()) ?? null,
    video: videoPlan(ctx),
  };
};
const rawVideo = (scenes: Record<string, unknown>[]) =>
  rawBriefSchema.parse({
    message: "Handmade rings made to last",
    hooks: [{ type: "question", text: "Who made your ring?" }],
    chosenHook: 1,
    framework: "aida",
    levers: [],
    cta: { label: "Shop now", link: "website" },
    claims: [],
    captions: { instagram: "Handmade. #rings" },
    scenes,
    musicMood: "upbeat",
  });
const sc = (over: Record<string, unknown>) => ({ kind: "detail", source: "AI", voiceover: "", seconds: 3, overlay: "", keywords: [], visual: "Close-up of a silver ring on a linen cloth", motion: "slow push in", transition: "smooth", ...over });

await check("assembleBrief (video): V/G labels become real footage and photos; showcase is music only", () => {
  const ctx = ctxFor("showcase");
  const out = assembleBrief(
    rawVideo([sc({ kind: "hook", source: "V1", overlay: "Made by hand", keywords: ["hand"] }), sc({ source: "G1", voiceover: "dropped" }), sc({ kind: "product", price: true }), sc({ kind: "cta", seconds: 2 })]),
    "video",
    ctx,
    bookFor(ctx)
  );
  assert.ok(out.brief, out.problems.join("; "));
  const b = out.brief as VideoBrief;
  assert.equal(b.sound, "music");
  assert.equal(b.preset, "editorial");
  assert.equal(b.musicMood, "calm");
  assert.deepEqual(b.scenes[0].source, { kind: "clip", assetId: moment({}).assetId, start: 2, end: 8, keepAudio: false });
  assert.deepEqual(b.scenes[1].source, { kind: "photo", assetId: "00000000-0000-4000-8000-000000000001" });
  assert.equal(b.scenes[1].voiceover, "", "music-only scenes have no voice-over");
  assert.equal(b.scenes[2].showPrice, true);
  assert.deepEqual(b.scenes[0].keywords, ["hand"]);
  assert.deepEqual(checkBrief(b, ctx), []);
});

await check("assembleBrief (video): talking moments keep their sound; stats and reviews keep their facts", () => {
  const ctx = ctxFor("talking", [moment({}), talkingMoment]);
  const out = assembleBrief(
    rawVideo([
      sc({ kind: "hook", source: "V2", overlay: "Why I wear it daily" }),
      sc({ kind: "detail", source: "V1" }),
      sc({ kind: "stat", stat: { value: 4.9, label: "average rating", source: "R1" } }),
      sc({ kind: "review", review: "R1" }),
      sc({ kind: "cta", seconds: 2 }),
    ]),
    "video",
    ctx,
    bookFor(ctx)
  );
  const b = out.brief as VideoBrief;
  assert.equal(b.sound, "speech");
  assert.ok(b.scenes[0].source.kind === "clip" && b.scenes[0].source.keepAudio, "talking moment keeps its sound");
  assert.ok(b.scenes[0].source.kind === "clip" && b.scenes[0].source.end - b.scenes[0].source.start <= 12, "talking moments are capped");
  assert.equal(b.scenes[2].stat?.source, `proof:${proofId}`);
  assert.equal(b.scenes[3].proofId, proofId);
  assert.deepEqual(checkBrief(b, ctx), []);
});

await check("checkBrief (video): storyline shape, short footage, numbers not in their fact", () => {
  const ctx = ctxFor("showcase", [moment({ start: 0, end: 1.5 })]);
  const out = assembleBrief(
    rawVideo([sc({ kind: "problem", overlay: "" }), sc({ kind: "step", source: "V1", seconds: 5 }), sc({ kind: "stat", stat: { value: 7, label: "years", source: "R1" } })]),
    "video",
    ctx,
    bookFor(ctx)
  );
  const problems = checkBrief(out.brief as VideoBrief, ctx);
  const has = (text: string) => assert.ok(problems.some((p) => p.includes(text)), `expected "${text}" in: ${problems.join(" | ")}`);
  has('Scene 1 must be kind "hook"');
  has('The last scene must be kind "cta"');
  has("doesn't use");
  has("needs about 5s");
  has("isn't in the fact it cites");
  has("hook scene needs its on-screen line");
});

// ---------- Timeline ----------

const canvas = videoCanvas("9:16");
const theme = {
  primary: { bg: "#2F45C5", text: "#ffffff" },
  accent: { bg: "#FFC83D", text: "#15171C" },
  light: { bg: "#ffffff", text: "#15171C" },
  dark: { bg: "#15171C", text: "#ffffff" },
  heading: "Inter",
  body: "Inter",
  fonts: [],
  logo: { onLight: "https://x/logo.png", onDark: null },
  businessName: "Acme",
};
const image = { kind: "image" as const, url: "https://x/a.png", motion: { fromScale: 1, toScale: 1, fromX: 0, toX: 0, fromY: 0, toY: 0 } };
const scene = (over: Partial<BuildScene>): BuildScene => ({
  kind: "benefit",
  media: image,
  reveal: null,
  layout: { subject: { x: 0.25, y: 0.2, w: 0.5, h: 0.4 }, zone: "bottom", light: false },
  voice: null,
  speech: null,
  seconds: 3,
  overlay: "",
  keywords: [],
  sticker: null,
  stat: null,
  review: null,
  price: null,
  offer: null,
  transition: "smooth",
  ...over,
});
const voice = (text: string) => ({ url: "https://x/v.mp3", durationSec: text.split(" ").length * 0.4, words: text.split(" ").map((word, i) => ({ word, start: i * 0.4, end: i * 0.4 + 0.35 })) });
const input = (scenes: BuildScene[], preset: "bold" | "editorial" = "bold") => ({
  canvas,
  preset,
  theme,
  scenes,
  hook: "Stop scrolling",
  cta: { label: "Shop now", line: "", link: "acme.com" },
  music: { url: "https://x/m.mp3" },
  sfx: { whoosh: "https://x/whoosh.wav", pop: "https://x/pop.wav", ding: "https://x/ding.wav", click: "https://x/click.wav" },
  progressBar: true,
});

await check("buildTimeline: voices run back to back; transitions overlap only the pauses", () => {
  const t = buildTimeline(input([scene({ kind: "hook", voice: voice("Your kitchen deserves better"), overlay: "Your kitchen deserves better" }), scene({ voice: voice("We clean it top to bottom"), transition: "energetic" }), scene({ kind: "cta", seconds: 2.5 })]));
  const [v1, v2] = t.audio.voice;
  const firstEnd = v1.startFrame + Math.round((voice("Your kitchen deserves better").durationSec + 0.35) * FPS);
  assert.ok(v2.startFrame >= firstEnd - 1, `voice 2 at ${v2.startFrame}, voice 1 ends ${firstEnd}`);
  assert.equal(t.scenes[1].startFrame, t.scenes[0].startFrame + t.scenes[0].durationFrames - t.transitions[0].durationFrames);
  assert.equal(t.durationInFrames, t.scenes[2].startFrame + t.scenes[2].durationFrames);
  // The last cut into the closing card is a reveal
  assert.equal(t.transitions[1].kind, PRESETS.bold.transitions.reveal.kind);
});

await check("buildTimeline: captions follow the voice; key words stand out; pages by the preset", () => {
  const t = buildTimeline(input([scene({ kind: "hook", overlay: "Fresh start" }), scene({ voice: voice("Book your deep clean today"), keywords: ["deep clean"] }), scene({ kind: "cta", seconds: 2.5 })]));
  const words = t.captions.flatMap((p) => p.words);
  assert.deepEqual(words.map((w) => w.text), ["Book", "your", "deep", "clean", "today"]);
  assert.deepEqual(words.filter((w) => w.emphasis).map((w) => w.text), ["deep", "clean"]);
  assert.ok(t.captions.every((p) => p.words.length <= PRESETS.bold.captions.wordsPerPage));
  assert.ok(words.every((w, i) => i === 0 || w.startFrame >= words[i - 1].startFrame));
});

await check("buildTimeline: the hook title opens at frame 0; the sticker and price land when their key word is said", () => {
  const t = buildTimeline(input([scene({ kind: "hook" }), scene({ kind: "product", voice: voice("Only today our ring shines"), keywords: ["ring"], sticker: "✨", price: "€89" }), scene({ kind: "cta", seconds: 2.5 })]));
  const hook = t.layers.find((l) => l.kind === "title");
  assert.ok(hook && hook.startFrame === 0 && hook.kind === "title" && hook.role === "hook" && hook.words.map((w) => w.text).join(" ") === "Stop scrolling");
  const ringWord = t.captions.flatMap((p) => p.words).find((w) => w.text === "ring")!;
  assert.equal(t.layers.find((l) => l.kind === "sticker")!.startFrame, ringWord.startFrame);
  assert.equal(t.layers.find((l) => l.kind === "price")!.startFrame, ringWord.startFrame);
  assert.ok(t.audio.sfx.some((s) => s.startFrame === ringWord.startFrame && s.url.includes("pop")));
});

await check("buildTimeline: the closing card is last; logo and progress stop there; music ducks under speech", () => {
  const t = buildTimeline(input([scene({ kind: "hook", voice: voice("Hello there friend") }), scene({ kind: "cta", seconds: 2.5 })]));
  const card = t.layers.find((l) => l.kind === "endCard")!;
  assert.equal(card.startFrame, t.scenes[1].startFrame);
  assert.equal(t.logoBug?.untilFrame, t.scenes[1].startFrame);
  assert.ok(t.audio.music && t.audio.music.speech.length === 1 && t.audio.music.duckedVolume < t.audio.music.volume);
  assert.ok(t.audio.sfx.some((s) => s.url.includes("click") && s.startFrame > card.startFrame));
});

await check("buildTimeline: no logo when the business chose none; editorial adds light leaks on reveals", () => {
  const t = buildTimeline({ ...input([scene({ kind: "hook" }), scene({ transition: "reveal" }), scene({ kind: "cta", seconds: 2.5 })], "editorial"), theme: { ...theme, logo: null } });
  assert.equal(t.logoBug, null);
  assert.ok(!t.transitions[0].lightLeak && t.transitions[1].lightLeak, "only reveal cuts and the last cut get light");
  assert.equal(t.layers.filter((l) => l.kind === "sticker").length, 0, "editorial has no stickers");
});

await check("zonesFor / besideSubject: words avoid the subject and each other; stickers stay in the safe area", () => {
  const top = zonesFor(scene({ layout: { subject: { x: 0.2, y: 0.5, w: 0.6, h: 0.4 }, zone: "top", light: null } }), true);
  assert.equal(top.title, "top");
  assert.notEqual(top.captions, "top");
  const spot = besideSubject({ x: 0.05, y: 0.3, w: 0.5, h: 0.4 }, canvas, "top");
  assert.ok(spot.x > 0.55, "sticker goes on the side with more room");
  const edge = besideSubject({ x: 0.0, y: 0.0, w: 0.98, h: 0.1 }, canvas, "top");
  assert.ok(edge.y >= canvas.safe.top / canvas.height && edge.x <= 1 - canvas.safe.right / canvas.width);
});

await check("motionFor: stills push in towards the subject; wide subjects pan", () => {
  const push = motionFor("detail", { x: 0.6, y: 0.1, w: 0.3, h: 0.3 }, 0.1);
  assert.ok(push.toScale > push.fromScale && push.toX < 0 && push.toY > 0);
  const pan = motionFor("benefit", { x: 0, y: 0.3, w: 0.9, h: 0.3 }, 0.1);
  assert.equal(pan.fromScale, pan.toScale);
});

await check("parts: footage layout, prices and links as people read them", () => {
  const l = momentLayout({ subject: { x: "left", y: "top" }, textArea: "bottom", people: "person", shot: "medium" });
  assert.ok(l.subject.x < 0.1 && l.subject.y < 0.2 && l.zone === "bottom");
  assert.equal(priceText(89, "EUR", "from"), "From €89");
  assert.equal(priceText(49.5, "USD", null), "$49.50");
  assert.equal(linkText("https://www.acme.com/shop/"), "acme.com/shop");
  assert.equal(linkText("+44 7700 900123"), "+44 7700 900123");
});

console.log(`\n${passed} checks passed${process.exitCode ? ", some FAILED" : ""}`);
