// Offline checks of the weekly loop's pure logic (Planner slots, brief checks, captions, renders).
// No vendor calls, no database. Run: npm run smoke scripts/check/weekly-logic.ts
import assert from "node:assert/strict";
import { addDays, nextWeekStart, weekStartOf, zonedParts, zonedToUtc } from "@/lib/zoned-time";
import { allocate, allowedFormats, avoidRepeats, planSlots } from "@/agents/planner/slots";
import { assembleBrief } from "@/agents/creative-director/assemble";
import { checkBrief, findBanned } from "@/agents/creative-director/checks";
import type { FactBook } from "@/agents/creative-director/book";
import type { CreativeContext } from "@/agents/creative-director/context";
import { rawBriefSchema } from "@/prompts/agents/creative-brief";
import { overallScore } from "@/prompts/agents/qa-brief";
import { buildAss, groupWords } from "@/creative/subtitles";
import { CANVAS } from "@/creative/sizes";
import { fitText } from "@/creative/fit";
import { buildComposeJob } from "@/providers/ffmpeg/compose-video";
import { canvasesFor } from "@/agents/producer/canvases";
import type { PlanItem } from "@/core/plans/types";
import { stripLabels, stripLabelsDeep } from "@/lib/labels";

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
        console.error(`FAIL ${name}: ${e.message}`);
        process.exitCode = 1;
      }
    );

// ---------- Time zones ----------

await check("zonedToUtc: Kolkata 09:00 is 03:30 UTC", () => {
  assert.equal(zonedToUtc("2026-11-02", "09:00", "Asia/Kolkata").toISOString(), "2026-11-02T03:30:00.000Z");
});

await check("zonedToUtc: Malta across the October clock change", () => {
  // Summer time (UTC+2) until 25 Oct 2026 03:00, then UTC+1
  assert.equal(zonedToUtc("2026-10-24", "18:00", "Europe/Malta").toISOString(), "2026-10-24T16:00:00.000Z");
  assert.equal(zonedToUtc("2026-10-26", "18:00", "Europe/Malta").toISOString(), "2026-10-26T17:00:00.000Z");
});

await check("weeks start on Monday; next week is never this week", () => {
  assert.equal(weekStartOf("2026-10-25"), "2026-10-19"); // Sunday → previous Monday
  assert.equal(weekStartOf("2026-10-26"), "2026-10-26"); // Monday
  assert.equal(nextWeekStart("2026-10-26"), "2026-11-02");
  assert.equal(nextWeekStart("2026-10-25"), "2026-10-26");
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
});

await check("zonedParts: weekday and hour in the client's zone", () => {
  const p = zonedParts(new Date("2026-10-25T20:30:00Z"), "Asia/Kolkata");
  assert.equal(p.day, "2026-10-26");
  assert.equal(p.weekday, 1);
  assert.equal(p.hour, 2);
});

// ---------- Planner slots ----------

await check("allocate: largest remainder adds up and follows shares", () => {
  const out = allocate(7, [
    { id: "a", share: 0.4 },
    { id: "b", share: 0.35 },
    { id: "c", share: 0.25 },
  ]);
  assert.equal([...out.values()].reduce((x, y) => x + y, 0), 7);
  assert.deepEqual([out.get("a"), out.get("b"), out.get("c")], [3, 2, 2]);
});

await check("allowedFormats: TikTok/YouTube video only, text only on text-friendly platforms", () => {
  assert.deepEqual(allowedFormats(["tiktok"]), ["video"]);
  assert.deepEqual(allowedFormats(["instagram", "youtube"]), ["video"]);
  assert.ok(!allowedFormats(["instagram"]).includes("text"));
  assert.ok(allowedFormats(["linkedin", "facebook"]).includes("text"));
});

const pillars = [
  { id: "p1", name: "Education", share: 0.4, funnelStage: "tofu" as const },
  { id: "p2", name: "Proof", share: 0.3, funnelStage: "mofu" as const },
  { id: "p3", name: "Offers", share: 0.3, funnelStage: "bofu" as const },
];

await check("planSlots: slot count, platforms spread, formats fit, times in the client's zone", () => {
  const slots = planSlots({ weekStart: "2026-11-02", timezone: "Europe/Malta", postsPerWeek: { instagram: 5, linkedin: 2, tiktok: 2 }, pillars, goal: "sales" });
  assert.equal(slots.length, 5);
  assert.equal(slots.filter((s) => s.platforms.includes("linkedin")).length, 2);
  assert.equal(slots.filter((s) => s.platforms.includes("tiktok")).length, 2);
  for (const s of slots) {
    if (s.platforms.includes("tiktok")) assert.equal(s.format, "video");
    assert.ok(s.day >= "2026-11-02" && s.day <= "2026-11-08", `day ${s.day} inside the week`);
    assert.equal(zonedParts(new Date(s.slotAt), "Europe/Malta").time, s.time);
  }
  // ±1 slot of each pillar's target
  for (const p of pillars) assert.ok(Math.abs(slots.filter((s) => s.pillarId === p.id).length - p.share * 5) <= 1);
  assert.equal(slots.filter((s) => s.isExperiment).length, 2); // 30% of 5, rounded
});

await check("planSlots: no format twice in a row on the same platform when there's a choice", () => {
  const slots = planSlots({ weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: { instagram: 7 }, pillars, goal: "awareness" });
  for (let i = 1; i < slots.length; i++) assert.notEqual(slots[i].format, slots[i - 1].format, `slots ${i} and ${i + 1}`);
});

await check("planSlots: proven formats get more slots", () => {
  const base = planSlots({ weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: { facebook: 14 }, pillars, goal: null });
  const boosted = planSlots({ weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: { facebook: 14 }, pillars, goal: null, formatScores: { video: 1.8 } });
  const videos = (list: typeof base) => list.filter((s) => s.format === "video").length;
  assert.ok(videos(boosted) > videos(base), `${videos(boosted)} > ${videos(base)}`);
});

await check("planSlots: nothing to plan without posts per week", () => {
  assert.equal(planSlots({ weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: {}, pillars, goal: null }).length, 0);
});

await check("planSlots: a part week starts at firstDay and gets its share of posts", () => {
  const slots = planSlots({ weekStart: "2026-10-19", firstDay: "2026-10-23", timezone: "UTC", postsPerWeek: { instagram: 7, linkedin: 2 }, pillars, goal: null });
  assert.ok(slots.length > 0 && slots.every((s) => s.day >= "2026-10-23" && s.day <= "2026-10-25"), slots.map((s) => s.day).join(","));
  assert.equal(slots.length, 3); // 7 a week × 3 days left ÷ 7
  assert.equal(planSlots({ weekStart: "2026-10-19", firstDay: "2026-10-26", timezone: "UTC", postsPerWeek: { instagram: 7 }, pillars, goal: null }).length, 0);
});

await check("planSlots: no video and no video-only platforms while video isn't set up", () => {
  const slots = planSlots({ weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: { instagram: 5, tiktok: 3, youtube: 2 }, pillars, goal: null, videoAllowed: false });
  assert.equal(slots.length, 5);
  assert.ok(slots.every((s) => s.format !== "video" && !s.platforms.includes("tiktok") && !s.platforms.includes("youtube")));
  assert.deepEqual(allowedFormats(["tiktok"], false), []);
});

await check("avoidRepeats: swaps a back-to-back repeat on a shared platform", () => {
  const items = [
    { platforms: ["instagram"], k: "A" },
    { platforms: ["instagram"], k: "A" },
    { platforms: ["instagram"], k: "B" },
  ];
  avoidRepeats(items, (s) => s.k, (a, b) => ([a.k, b.k] = [b.k, a.k]));
  assert.deepEqual(
    items.map((i) => i.k),
    ["A", "B", "A"]
  );
});

// ---------- Creative Director ----------

const item = { id: "i1", platforms: ["instagram", "linkedin"], format: "static" } as unknown as PlanItem;
const ctx = {
  item,
  ctaLinks: { website: "https://acme.com", booking: "https://acme.com/book" },
  avoidWords: ["cheap"],
  bible: { neverSay: ["guaranteed"] },
  offer: null,
} as unknown as CreativeContext;
const book: FactBook = {
  text: "",
  ref: (l) => ({ O1: "offering:o1", R1: "proof:r1", C1: "chunk:c1" })[String(l ?? "").replace(/^\[|\]$/g, "").toUpperCase()] ?? null,
  asset: (l) => (l === "G1" ? "00000000-0000-4000-8000-000000000001" : null),
  priceLabels: new Set(["O1"]),
};
const raw = (over: Record<string, unknown> = {}) =>
  rawBriefSchema.parse({
    message: "Book a deep clean before the holidays",
    hooks: [
      { type: "question", text: "When did you last see your oven glass?" },
      { type: "number", text: "3 spots every kitchen forgets" },
    ],
    chosenHook: 1,
    framework: "pas",
    levers: [
      { lever: "social_proof", source: "R1" },
      { lever: "urgency", source: null },
    ],
    cta: { label: "Book a clean", link: "shop" },
    claims: [
      { text: "Rated 4.9 by 120 clients", source: "R1" },
      { text: "Number one in Malta", source: "X9" },
    ],
    captions: { instagram: "Kitchen deep clean…", linkedin: "Kitchens…" },
    photo: "G1",
    headline: "Your kitchen, like new",
    subhead: "Deep clean in one visit",
    badge: { text: "From €49", source: "F1" },
    imagePrompt: "A spotless modern kitchen in soft morning light, empty counter on the right",
    layout: "split",
    ...over,
  });

await check("assembleBrief: maps labels, drops unbacked claims, badge and fact levers", () => {
  const out = assembleBrief(raw(), "static", ctx, book);
  assert.ok(out.brief, out.problems.join("; "));
  const b = out.brief!;
  assert.equal(b.kind, "static");
  assert.deepEqual(b.claims, [{ text: "Rated 4.9 by 120 clients", source: "proof:r1" }]);
  assert.deepEqual(
    b.levers.map((l) => l.lever),
    ["social_proof"]
  );
  assert.equal(b.kind === "static" && b.badge, null); // F1 isn't a fact here
  assert.equal(b.cta.link, "website"); // no shop link: falls back
  assert.equal(b.referenceAssetId, "00000000-0000-4000-8000-000000000001");
  assert.equal(out.dropped, 3);
});

await check("assembleBrief: a missing caption is a problem to fix", () => {
  const out = assembleBrief(raw({ captions: { instagram: "Only one" } }), "static", ctx, book);
  assert.ok(out.problems.some((p) => p.includes("linkedin")));
});

await check("checkBrief: word limits, never-say words, urgency without an offer", () => {
  const out = assembleBrief(raw({ headline: "The cheap way to a guaranteed spotless kitchen today only" }), "static", ctx, book);
  const problems = checkBrief(out.brief!, ctx);
  assert.ok(problems.some((p) => p.startsWith("The headline has")));
  assert.ok(problems.some((p) => p.includes("cheap") && p.includes("guaranteed")));
  assert.ok(problems.some((p) => p.includes("urgency")));
});

await check("findBanned: whole words only, any case", () => {
  assert.deepEqual(findBanned(["Cheaper than ever"], ["cheap"]), []);
  assert.deepEqual(findBanned(["So CHEAP!"], ["cheap"]), ["cheap"]);
  assert.deepEqual(findBanned(["no risk at all"], ["no risk"]), ["no risk"]);
});

await check("overallScore: weighted, one decimal", () => {
  assert.equal(overallScore({ hook: 8, oneMessage: 7, personaFit: 7, cta: 7, proof: 6, compliance: 9 }), 7.6);
});

await check("stripLabels: source tags leave client text, label fields stay", () => {
  assert.equal(stripLabels("Find the repetitive work [C10, C6, C8]"), "Find the repetitive work");
  assert.equal(stripLabels("Rated 4.9 [R1] by clients [O2]"), "Rated 4.9 by clients");
  assert.equal(stripLabels("Keep [brackets like this]"), "Keep [brackets like this]");
  assert.deepEqual(stripLabelsDeep({ name: "Owner [P1]", source: "[R1]", list: ["a [C2]"] }), { name: "Owner", source: "[R1]", list: ["a"] });
});

// ---------- Rendering ----------

await check("fitText: long headlines shrink, short ones stay big", () => {
  const short = fitText("Fresh start", { maxWidth: 900, maxHeight: 300, max: 110, min: 50 });
  const long = fitText("Everything you need to know before you book a kitchen deep clean this winter", { maxWidth: 900, maxHeight: 300, max: 110, min: 50 });
  assert.equal(short.size, 110);
  assert.ok(long.size < 80 && long.size >= 50);
});

await check("canvasesFor: video adds 4:5 for feed platforms; static per platform size", () => {
  assert.deepEqual(
    canvasesFor("video", ["tiktok"]).map((c) => c.ratio),
    ["9:16"]
  );
  assert.deepEqual(
    canvasesFor("video", ["instagram", "linkedin"]).map((c) => c.ratio),
    ["9:16", "4:5"]
  );
  assert.deepEqual(
    canvasesFor("static", ["instagram", "linkedin", "twitter"]).map((c) => c.ratio),
    ["4:5", "1:1", "16:9"]
  );
});

await check("groupWords: up to three words, breaks at sentence ends", () => {
  const w = (word: string, i: number) => ({ word, start: i, end: i + 0.5 });
  const groups = groupWords(["Clean", "kitchens.", "Happy", "homes", "every", "week"].map(w));
  assert.deepEqual(
    groups.map((g) => g.map((x) => x.word).join(" ")),
    ["Clean kitchens.", "Happy homes every", "week"]
  );
});

await check("buildAss: styles, overlays, highlighted words with lowercase override tags", () => {
  const ass = buildAss({
    canvas: CANVAS["9:16"],
    words: [
      { word: "Hello", start: 0, end: 0.4 },
      { word: "there", start: 0.45, end: 0.9 },
    ],
    overlays: [{ text: "Stop scrolling", start: 0, end: 2 }],
    font: "Inter",
    highlight: "#ffcc00",
    highlightText: "#111111",
  });
  assert.ok(ass.includes("PlayResX: 1080") && ass.includes("PlayResY: 1920"));
  assert.ok(ass.includes("Style: Caption,Inter,"));
  assert.ok(ass.includes(",Hook,,0,0,0,,{\\fad(120,200)}Stop scrolling"));
  assert.ok(ass.includes("{\\c&H0000CCFF}HELLO{\\c&HFFFFFF&} THERE"));
  assert.ok(!ass.includes("\\C&"), "override tags stay lowercase");
});

await check("buildComposeJob: inputs in order, end card looped, captions with fontsdir, music under voice", () => {
  const job = buildComposeJob({
    width: 1080,
    height: 1920,
    clipUrls: ["https://x.kie.ai/a.mp4", "https://x.kie.ai/b.mp4"],
    sceneDurations: [3, 4],
    voiceKeys: ["audio/m/voice-0.mp3", "audio/m/voice-1.mp3"],
    musicKey: "audio/m/music.mp3",
    subtitlesKey: "videos/m/captions.ass",
    fontKeys: ["fonts/inter-800.ttf"],
    endCardKey: "videos/m/end.png",
    outputKey: "videos/m/out.mp4",
  });
  assert.deepEqual(job.inputs, [
    "https://x.kie.ai/a.mp4",
    "https://x.kie.ai/b.mp4",
    "audio/m/voice-0.mp3",
    "audio/m/voice-1.mp3",
    "audio/m/music.mp3",
    "videos/m/end.png",
    "videos/m/captions.ass",
    "fonts/inter-800.ttf",
  ]);
  const graph = job.args[job.args.indexOf("-filter_complex") + 1];
  assert.ok(job.args.join(" ").includes("-loop 1 -t 2.50 -i {input5}"));
  assert.ok(graph.includes("subtitles={input6}:fontsdir={dir}"));
  assert.ok(graph.includes("amix=inputs=2:duration=first:dropout_transition=0:normalize=0"));
  assert.ok(graph.includes("loudnorm=I=-14"));
  assert.equal(job.args[job.args.indexOf("-t", job.args.indexOf("-filter_complex")) + 1], "9.50");
  assert.equal(job.args.at(-1), "{output}");
});

await check("buildComposeJob: silent video without voice or music", () => {
  const job = buildComposeJob({ width: 1080, height: 1350, clipUrls: ["https://x.kie.ai/a.mp4"], sceneDurations: [5], outputKey: "videos/m/out.mp4" });
  assert.ok(job.args.includes("-an"));
  assert.equal(job.inputs.length, 1);
});

console.log(`\n${passed} checks passed${process.exitCode ? ", some FAILED" : ""}`);
