// Offline checks of the weekly loop's pure logic (Planner slots, brief checks, captions, renders).
// No vendor calls, no database. Run: npm run smoke scripts/check/weekly-logic.ts
import assert from "node:assert/strict";
import { freeAdPrompt } from "@/agents/producer/static-free";
import { gpt2Resolution, openaiImageSize } from "@/config/image-ads";
import { directBrief, directContext, directPrompt } from "@/agents/creative-director/direct-context";

// Most checks below are about the designed layouts; the free image ad ones switch the mode on for their own run
process.env.IMAGE_AD_MODE = "designed";
import { addDays, nextWeekStart, weekStartOf, zonedParts, zonedToUtc } from "@/lib/zoned-time";
import { allocate, allowedFormats, avoidRepeats, planSlots } from "@/agents/planner/slots";
import { assembleBrief, pickDesign } from "@/agents/creative-director/assemble";
import { checkBrief, findBanned, pricesIn } from "@/agents/creative-director/checks";
import type { FactBook } from "@/agents/creative-director/book";
import type { CreativeContext } from "@/agents/creative-director/context";
import { rawBriefSchema } from "@/prompts/agents/creative-brief";
import { colourWord, photoWords, pictureOnly } from "@/agents/producer/picture-only";
import { adPhotoPrompt, photoPrompt, referenceUse } from "@/agents/producer/photos";
import { overallScore } from "@/prompts/agents/qa-brief";
import { buildAss, groupWords } from "@/creative/subtitles";
import { CANVAS } from "@/creative/sizes";
import { fitText } from "@/creative/fit";
import { buildComposeJob } from "@/providers/ffmpeg/compose-video";
import { canvasesFor } from "@/agents/producer/canvases";
import type { PlanItem } from "@/core/plans/types";
import { stripLabels, stripLabelsDeep } from "@/lib/labels";
import { contentRules } from "@/core/content/prefs";
import { IMAGE_STYLE_LAYOUTS, layoutsFor, stylesFor } from "@/core/content/styles";
import { LAYOUT_PHOTO, TEMPLATE_NOTES } from "@/creative/templates/notes";
import { TEMPLATE_IDS, type TemplateId } from "@/core/creative/brief";
import { IMAGE_STYLES } from "@/core/onboarding/options";

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
  const slots = planSlots({ weekStart: "2026-11-02", timezone: "Europe/Malta", postsPerWeek: { instagram: 5, linkedin: 2, tiktok: 2 }, pillars, goals: ["sales"] });
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
  const slots = planSlots({ weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: { instagram: 7 }, pillars, goals: ["awareness"] });
  for (let i = 1; i < slots.length; i++) assert.notEqual(slots[i].format, slots[i - 1].format, `slots ${i} and ${i + 1}`);
});

await check("planSlots: proven formats get more slots", () => {
  const base = planSlots({ weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: { facebook: 14 }, pillars });
  const boosted = planSlots({ weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: { facebook: 14 }, pillars, formatScores: { video: 1.8 } });
  const videos = (list: typeof base) => list.filter((s) => s.format === "video").length;
  assert.ok(videos(boosted) > videos(base), `${videos(boosted)} > ${videos(base)}`);
});

await check("planSlots: nothing to plan without posts per week", () => {
  assert.equal(planSlots({ weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: {}, pillars }).length, 0);
});

await check("planSlots: a part week starts at firstDay and gets its share of posts", () => {
  const slots = planSlots({ weekStart: "2026-10-19", firstDay: "2026-10-23", timezone: "UTC", postsPerWeek: { instagram: 7, linkedin: 2 }, pillars });
  assert.ok(slots.length > 0 && slots.every((s) => s.day >= "2026-10-23" && s.day <= "2026-10-25"), slots.map((s) => s.day).join(","));
  assert.equal(slots.length, 3); // 7 a week × 3 days left ÷ 7
  assert.equal(planSlots({ weekStart: "2026-10-19", firstDay: "2026-10-26", timezone: "UTC", postsPerWeek: { instagram: 7 }, pillars }).length, 0);
});

await check("planSlots (auto-create): the chosen number of each kind over the given days, on the platforms that take it", () => {
  const days = ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"];
  const base = { weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: { instagram: 5, linkedin: 2, tiktok: 3 }, pillars, goals: ["sales"] };
  const counts = (static_: number, carousel: number, video: number) => ({ static: static_, carousel, video });
  const kinds = (slots: { format: string }[]) => ({ static: slots.filter((s) => s.format === "static").length, carousel: slots.filter((s) => s.format === "carousel").length, video: slots.filter((s) => s.format === "video").length });
  // The default: two images and one video, interleaved so the video isn't last
  const mixed = planSlots({ ...base, batch: { counts: counts(2, 0, 1), days } });
  assert.deepEqual(kinds(mixed), counts(2, 0, 1));
  assert.deepEqual(mixed.map((s) => s.format), ["static", "video", "static"]);
  assert.equal(mixed.filter((s) => s.platforms.includes("instagram")).length, 3);
  assert.ok(mixed.every((s) => days.includes(s.day) && s.style));
  // The days are spread
  assert.ok(new Set(mixed.map((s) => s.day)).size > 1);
  // Platforms that can't take a kind are left out of its posts (linkedin takes no video here)
  assert.ok(mixed.filter((s) => s.format === "video").every((s) => s.platforms.length > 0));
  // Every kind at once, and one kind alone
  assert.deepEqual(kinds(planSlots({ ...base, batch: { counts: counts(2, 2, 2), days } })), counts(2, 2, 2));
  const images = planSlots({ ...base, batch: { counts: counts(4, 0, 0), days } });
  assert.ok(images.length === 4 && images.every((s) => s.format === "static" && !s.platforms.includes("tiktok")));
  // Videos by name beat an images-only mix
  const videos = planSlots({ ...base, mix: "images", batch: { counts: counts(0, 0, 2), days } });
  assert.ok(videos.length === 2 && videos.every((s) => s.format === "video"));
  // No video renderer: the videos have nothing to make, the images still do
  assert.deepEqual(kinds(planSlots({ ...base, videoAllowed: false, batch: { counts: counts(1, 0, 2), days } })), counts(1, 0, 0));
  // Carousels work even when the client only picked single-image styles
  const carousels = planSlots({ ...base, styles: { image: ["product"], video: [] }, batch: { counts: counts(0, 2, 0), days } });
  assert.ok(carousels.length === 2 && carousels.every((s) => s.format === "carousel" && s.style));
  // One chosen day takes every post, at different times
  const oneDay = planSlots({ ...base, batch: { counts: counts(2, 1, 1), days: ["2026-11-05"] } });
  assert.ok(oneDay.length === 4 && oneDay.every((s) => s.day === "2026-11-05"));
  assert.equal(new Set(oneDay.map((s) => s.time)).size, 4);
  // A week plan is unchanged by all this
  assert.equal(planSlots(base).length, 5);
});

await check("planSlots: no video and no video-only platforms while video isn't set up", () => {
  const slots = planSlots({ weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: { instagram: 5, tiktok: 3, youtube: 2 }, pillars, videoAllowed: false });
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

const item = { id: "i1", platforms: ["instagram", "linkedin"], format: "static", style: null } as unknown as PlanItem;
const ctx = {
  item,
  rules: contentRules(null),
  ctaLinks: { website: "https://acme.com", booking: "https://acme.com/book" },
  avoidWords: ["cheap"],
  bible: { neverSay: ["guaranteed"] },
  offer: null,
  offering: null,
  assets: [],
  layouts: ["split", "spotlight", "poster"],
  recentDesigns: [],
} as unknown as CreativeContext;
const book: FactBook = {
  text: "",
  ref: (l) => ({ O1: "offering:o1", R1: "proof:r1", C1: "chunk:c1" })[String(l ?? "").replace(/^\[|\]$/g, "").toUpperCase()] ?? null,
  asset: (l) => (l === "G1" ? "00000000-0000-4000-8000-000000000001" : null),
  priceLabels: new Set(["O1"]),
  moment: () => null,
  video: null,
};
const raw = (over: Record<string, unknown> = {}) =>
  rawBriefSchema.parse({
    message: "Book a deep clean before the holidays",
    hooks: [
      { type: "question", text: "When did you last see your oven glass?" },
      { type: "number_list", text: "3 spots every kitchen forgets", visual: "A hand wipes a greasy oven door", spoken: null, score: 4 },
    ],
    diagnosis: { desire: "comfort", awareness: "problem_aware", sophistication: 3, belief: "A deep clean is a chore", mechanism: "A trained crew with steam tools" },
    chosenHook: 1,
    framework: "pas",
    levers: [
      { lever: "social_proof", source: "R1" },
      { lever: "scarcity", source: null },
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

await check("assembleBrief: the diagnosis comes before the copy, and the slot's objective wins", () => {
  const ok = assembleBrief(raw(), "static", { ...ctx, item: { ...ctx.item, ad_objective: "converting" } } as CreativeContext, book);
  assert.equal(ok.brief?.diagnosis?.desire, "comfort");
  assert.equal(ok.brief?.objective, "converting");
  const none = assembleBrief(raw({ diagnosis: null }), "static", ctx, book);
  assert.ok(none.problems.some((p) => p.startsWith("Write the diagnosis")));
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

// ---------- The client's content choices ----------

await check("contentRules: reads the onboarding answers, open rules when unanswered", () => {
  const open = contentRules(null);
  assert.deepEqual([open.goals, open.mix, open.people, open.showLogo, open.cta], [[], null, null, true, null]);
  const r = contentRules({
    content_prefs: { goals: ["sales", "followers", "bogus"], mix: "images", image_styles: ["tips", "x"], video_styles: ["showcase"], people: "none", logo: "never" },
    primary_cta: "book",
    music_mood: "calm",
    industry: "health",
  });
  assert.deepEqual(r.goals, ["sales", "followers"]);
  assert.deepEqual(r.imageStyles, ["tips"]);
  assert.deepEqual(r.videoStyles, []); // images only: no video styles
  assert.equal(r.showLogo, false);
  assert.equal(r.cta, "book");
  assert.ok(r.industryNeverSay.length > 0);
  // Older businesses: the single goal column
  assert.deepEqual(contentRules({ primary_goal: "leads" }).goals, ["leads"]);
});

await check("planSlots: images only means no videos and no video-only platforms", () => {
  const slots = planSlots({ weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: { instagram: 7, tiktok: 3 }, pillars, mix: "images" });
  assert.equal(slots.length, 7);
  assert.ok(slots.every((s) => s.format !== "video" && !s.platforms.includes("tiktok")));
});

await check("planSlots: the content mix sets the share of videos", () => {
  const videos = (mix: "mostly-images" | "balanced" | "mostly-videos") =>
    planSlots({ weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: { instagram: 20 }, pillars, mix }).filter((s) => s.format === "video").length;
  const [few, half, most] = [videos("mostly-images"), videos("balanced"), videos("mostly-videos")];
  assert.ok(few < half && half < most, `${few} < ${half} < ${most}`);
  assert.ok(most >= 12, `mostly videos: ${most} of 20`);
});

await check("planSlots: styles follow the client's picks, in priority order, never twice in a row", () => {
  // Only single-image styles picked: no carousels
  const promo = planSlots({ weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: { instagram: 7 }, pillars, mix: "images", styles: { image: ["promo", "product"], video: [] } });
  assert.ok(promo.every((s) => s.format === "static" || s.format === "carousel"));
  assert.ok(promo.filter((s) => s.format === "carousel").every((s) => s.style === "product"), "promo can't be a carousel");
  assert.ok(promo.filter((s) => s.format === "static").every((s) => s.style === "promo" || s.style === "product"));
  // Tips only fits carousels, so statics have no style to use and aren't planned
  const tips = planSlots({ weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: { instagram: 5 }, pillars, mix: "images", styles: { image: ["tips"], video: [] } });
  assert.ok(tips.every((s) => s.format === "carousel" && s.style === "tips"), tips.map((s) => s.format).join(","));
  // First pick is used most
  const ranked = planSlots({ weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: { facebook: 14 }, pillars, mix: "images", styles: { image: ["product", "life", "review"], video: [] } });
  const count = (style: string) => ranked.filter((s) => s.style === style).length;
  assert.ok(count("product") > count("review"), `${count("product")} > ${count("review")}`);
});

await check("stylesFor: no people means no people styles; talking to camera is made as a voice-over for now", () => {
  assert.ok(!stylesFor("static", { image: ["people", "product"], video: [] }, "none").includes("people"));
  assert.deepEqual(stylesFor("video", { image: [], video: ["talking", "showcase"] }, "real"), ["faceless", "showcase"]);
  assert.deepEqual(stylesFor("video", { image: [], video: ["talking", "ugc"] }, "none"), []);
});

await check("planSlots: two goals split about two thirds to one third", () => {
  const slots = planSlots({ weekStart: "2026-11-02", timezone: "UTC", postsPerWeek: { instagram: 9 }, pillars: [], goals: ["sales", "followers"] });
  assert.equal(slots.filter((s) => s.goal === "sales").length, 6);
  assert.equal(slots.filter((s) => s.goal === "followers").length, 3);
  // Without pillars each goal's slots follow that goal's objective mix (knowledge base §7.2)
  const mix = (goal: string) => {
    const mine = slots.filter((s) => s.goal === goal);
    return [mine.filter((s) => s.adObjective === "awareness").length, mine.filter((s) => s.adObjective === "converting").length, mine.filter((s) => s.adObjective === "retargeting").length];
  };
  assert.deepEqual(mix("sales"), [2, 3, 1]); // 35 / 45 / 20 of 6
  assert.deepEqual(mix("followers"), [2, 1, 0]); // 60 / 30 / 10 of 3
  // The funnel stage follows the objective
  assert.ok(slots.every((s) => s.funnelStage === { awareness: "tofu", converting: "mofu", retargeting: "bofu" }[s.adObjective]));
});

await check("assembleBrief: the client's next step wins over a generic website link", () => {
  const withCta = { ...ctx, rules: { ...ctx.rules, cta: "book" } } as CreativeContext;
  assert.equal(assembleBrief(raw({ cta: { label: "Book a clean", link: "website" } }), "static", withCta, book).brief!.cta.link, "booking");
});

await check("checkBrief: no people means no person in the pictures (\"no people\" sentences are fine)", () => {
  const none = { ...ctx, rules: { ...ctx.rules, people: "none" } } as CreativeContext;
  const withWoman = assembleBrief(raw({ imagePrompt: "A smiling woman wiping a spotless kitchen counter in morning light" }), "static", none, book).brief!;
  assert.ok(checkBrief(withWoman, none).some((p) => p.includes("no people")));
  const empty = assembleBrief(raw({ imagePrompt: "A spotless kitchen in morning light. No people in the frame." }), "static", none, book).brief!;
  assert.ok(!checkBrief(empty, none).some((p) => p.includes("no people")));
});

await check("findBanned: whole words only, any case", () => {
  assert.deepEqual(findBanned(["Cheaper than ever"], ["cheap"]), []);
  assert.deepEqual(findBanned(["So CHEAP!"], ["cheap"]), ["cheap"]);
  assert.deepEqual(findBanned(["no risk at all"], ["no risk"]), ["no risk"]);
});

await check("overallScore: weighted, one decimal", () => {
  assert.equal(overallScore({ strategicFit: 8, hook: 8, oneMessage: 7, persuasion: 7, proof: 6, personaFit: 7, producibility: 7, brand: 9 }), 7.3);
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
    voiceKeys: ["work/b/m/voice-0.mp3", "work/b/m/voice-1.mp3"],
    musicKey: "work/b/m/music.mp3",
    subtitlesKey: "work/b/m/captions.ass",
    fontKeys: ["shared/fonts/inter-800.ttf"],
    endCardKey: "work/b/m/end.png",
    outputKey: "b/media/m/9x16.mp4",
  });
  assert.deepEqual(job.inputs, [
    "https://x.kie.ai/a.mp4",
    "https://x.kie.ai/b.mp4",
    "work/b/m/voice-0.mp3",
    "work/b/m/voice-1.mp3",
    "work/b/m/music.mp3",
    "work/b/m/end.png",
    "work/b/m/captions.ass",
    "shared/fonts/inter-800.ttf",
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
  const job = buildComposeJob({ width: 1080, height: 1350, clipUrls: ["https://x.kie.ai/a.mp4"], sceneDurations: [5], outputKey: "b/media/m/9x16.mp4" });
  assert.ok(job.args.includes("-an"));
  assert.equal(job.inputs.length, 1);
});

await check("pricesIn: finds money amounts in any common form, not plain numbers", () => {
  assert.deepEqual(pricesIn(["Holly, now $455", "₪1,400 for the cape", "only 499 ILS", "11 colours, sizes XS–XXL", "30% off"]), [455, 1400, 499]);
});

await check("pictureOnly: drops text, layout and font talk from a scene, keeps the picture and 'no text' lines", () => {
  const scene =
    "A woman walks toward the softly lit gathering, then pauses. Leave a generous white lower margin for the disclaimer. Hold this shot with the disclaimer overlay legible in high-contrast Fraunces type. Use accents in #81a2d0. No text, letters or logos in the scene.";
  const out = pictureOnly(scene);
  assert.equal(out, "A woman walks toward the softly lit gathering, then pauses. No text, letters or logos in the scene.");
  assert.equal(pictureOnly("Close-up of the cotton texture in warm side light."), "Close-up of the cotton texture in warm side light.");
});

// ---------- Image styles, layouts and designs ----------

await check("layoutsFor: each image style has its own layouts; the brand kit narrows them only when some fit", () => {
  for (const style of IMAGE_STYLES) assert.ok(IMAGE_STYLE_LAYOUTS[style].length >= 2, style);
  for (const id of TEMPLATE_IDS) assert.ok(TEMPLATE_NOTES[id] && LAYOUT_PHOTO[id], id);
  assert.deepEqual(layoutsFor("promo", []), ["offer", "bold", "split"]);
  assert.deepEqual(layoutsFor("promo", ["split", "frame"]), ["split"]);
  // A brand kit with no layout the style uses doesn't leave it with nothing
  assert.deepEqual(layoutsFor("review", ["spotlight"]), ["quote", "frame"]);
  assert.ok(!layoutsFor("product", []).includes("quote"));
});

await check("pickDesign: never the last ad's layout when another is allowed, never exactly its look", () => {
  const allowed: TemplateId[] = ["spotlight", "editorial", "frame"];
  const last = { layout: "spotlight" as TemplateId, align: "left", headlineCase: "normal", priceStyle: "circle" };
  const wantsSame = { layout: "spotlight" as TemplateId, design: { align: "left" as const, headlineCase: "normal" as const, priceStyle: "circle" as const } };
  assert.notEqual(pickDesign(wantsSame, { layouts: allowed, recentDesigns: [last] }).layout, "spotlight");
  // Only one layout allowed: it stays, and the look still changes
  const only = pickDesign(wantsSame, { layouts: ["spotlight"], recentDesigns: [last] });
  assert.equal(only.layout, "spotlight");
  assert.equal(only.design.align, "center");
  // A layout the style doesn't allow becomes the style's first
  assert.equal(pickDesign({ layout: "quote", design: null }, { layouts: allowed, recentDesigns: [] }).layout, "spotlight");
  // The layout used longest ago is preferred
  const recent = [last, { ...last, layout: "editorial" as TemplateId }];
  assert.equal(pickDesign(wantsSame, { layouts: allowed, recentDesigns: recent }).layout, "frame");
});

await check("assembleBrief (image): the product's price is written by code; offer and quote layouts need what they show", () => {
  const priced = { ...ctx, offering: { id: "o1", price: 1790, currency: "ILS", priceModel: null }, layouts: ["offer", "spotlight"] } as unknown as CreativeContext;
  const ok = assembleBrief(raw({ badge: { text: "1790 ILS", source: "O1" }, layout: "offer" }), "static", priced, book);
  assert.ok(ok.brief, ok.problems.join("; "));
  assert.equal(ok.brief?.kind === "static" && ok.brief.badge?.text, "₪1,790");
  assert.equal(ok.brief?.kind === "static" && ok.brief.layout, "offer");
  // No price behind it: the offer layout falls back to the style's other layout
  const noBadge = assembleBrief(raw({ badge: null, layout: "offer" }), "static", priced, book);
  assert.equal(noBadge.brief?.kind === "static" && noBadge.brief.layout, "spotlight");
  // A quote layout without a stored review claim falls back too
  const quoteCtx = { ...ctx, layouts: ["quote", "frame"] } as unknown as CreativeContext;
  const noReview = assembleBrief(raw({ claims: [], layout: "quote" }), "static", quoteCtx, book);
  assert.equal(noReview.brief?.kind === "static" && noReview.brief.layout, "frame");
});

await check("checkBrief (image): a product style needs a real product photo as the reference", () => {
  const withPhotos = { ...ctx, assets: [{ id: "a", kind: "product_photo" }] } as unknown as CreativeContext;
  const brief = (over: Record<string, unknown>) => assembleBrief(raw({ photo: null, ...over }), "static", withPhotos, book).brief!;
  assert.ok(checkBrief({ ...brief({}), style: "people" }, withPhotos).some((p) => p.includes("Show a real product")));
  assert.ok(!checkBrief({ ...brief({ photo: "G1" }), style: "people" }, withPhotos).some((p) => p.includes("Show a real product")));
  // No product photos to pick from: nothing to ask for
  assert.ok(!checkBrief({ ...brief({}), style: "people" }, ctx).some((p) => p.includes("Show a real product")));
});

await check("referenceUse and adPhotoPrompt: a product photo gives the product only; video prompts are unchanged", () => {
  assert.equal(referenceUse("product_photo"), "product");
  assert.equal(referenceUse("team"), "person");
  assert.equal(referenceUse("location"), "place");
  const settings = { style: "warm", people: null as null };
  const product = adPhotoPrompt("A woman in the kaftan from G1 on a rooftop in #81a2d0 light.", settings, "product", null, LAYOUT_PHOTO.spotlight);
  assert.match(product, /different person from the one in the reference/);
  assert.match(product, /headwear, jewellery, accessories, props and background are left out/);
  assert.ok(!/G1|#81a2d0/.test(product), product);
  assert.match(adPhotoPrompt("Studio shot", settings, "person", null, ""), /keep their face and look exactly/);
  // A video scene's product photo gives the product only; a reveal's "before" is kept exactly
  assert.match(photoPrompt("A beach scene.", settings, "product"), /different person from the one in the reference/);
  assert.match(photoPrompt("A beach scene.", settings, "person"), /keep their face and look exactly/);
  assert.match(photoPrompt("A beach scene.", settings, "scene"), /same shape, colours, materials and details/);
  assert.doesNotMatch(photoPrompt("A beach scene.", settings, "scene"), /different person/);
});

await check("free image ad: no diagnosis, hook-variety or word-limit problems; the logo corner is kept; truth checks stay", () => {
  process.env.IMAGE_AD_MODE = "free";
  try {
    const out = assembleBrief(raw({ diagnosis: null, headline: "", logoCorner: "bottom-right", hooks: [{ type: "question", text: "Why save it for your suitcase?" }] }), "static", ctx, book);
    assert.ok(out.brief, out.problems.join("; "));
    assert.deepEqual(out.problems, []);
    assert.equal(out.brief.kind === "static" && out.brief.logoCorner, "bottom-right");
    assert.equal(out.brief.kind === "static" && out.brief.headline, "Why save it for your suitcase?"); // no words on the picture: the hook titles the post
    const problems = checkBrief(out.brief!, ctx);
    assert.ok(!problems.some((p) => /hook|diagnosis|words; keep it/i.test(p)), problems.join(" | "));
    // A price painted into the picture that is not the current one is still caught
    const wrongPrice = assembleBrief(raw({ diagnosis: null, imagePrompt: 'A bright kitchen with the text "Only €99" in the corner, plain space top left for a logo' }), "static", ctx, book);
    assert.ok(checkBrief(wrongPrice.brief!, ctx).some((p) => p.includes("prices that aren't the current ones")));
  } finally {
    process.env.IMAGE_AD_MODE = "designed";
  }
});

await check("freeAdPrompt: the director's words and quoted texts stay; the plain logo corner, the reference rule and redo notes are added", () => {
  const prompt = freeAdPrompt('A poster with the line "Why save it for your suitcase?" in big serif type. Use [G1] for the cape.', { style: "warm natural light", people: "none" }, "product", "the cape looked wrong", "top-right", true);
  assert.ok(prompt.includes('"Why save it for your suitcase?"'));
  assert.ok(!prompt.includes("[G1]"));
  assert.ok(prompt.includes("top-right corner plain"));
  assert.ok(prompt.includes("No people"));
  assert.ok(prompt.includes("reproduce the product exactly"));
  assert.ok(prompt.includes("other sizes"));
  assert.ok(prompt.includes("Fix these problems"));
});

await check("direct image ad: everything the director reads goes to the image model as plain facts; the brief is made by code", () => {
  const images = [
    { url: "https://x/p.jpg", what: 'real product photo of "Oven clean"' },
    { url: "https://x/logo.png", what: "the brand's logo" },
  ];
  // A fuller context than the shared fixture: the business, voice, product, reviews and website text
  const full = {
    ...ctx,
    business: { name: "Acme Clean", language: "en", description: "Kitchen deep cleaning", tone: "casual, calm", goals: ["bookings"] },
    bible: { positioning: "The deep clean that fits your week", valueProp: "", tone: "Warm", traits: ["Direct"], examples: [], dos: [], donts: [], neverSay: ["guaranteed"], visualRules: [], strategy: null },
    persona: { id: "p", name: "Busy parent", summary: "No time", pains: ["no time"], desires: ["a clean kitchen"], objections: [], triggers: [], phrases: [] },
    pillar: null,
    offering: { id: "o1", name: "Oven clean", kind: "service", price: 89, currency: "EUR", priceModel: "fixed", description: "Full oven clean", benefits: ["Done in 2 hours"], audience: null, objections: [] },
    proof: [{ id: "r1", kind: "review", author: "Maria", rating: 5, content: "Spotless oven" }],
    passages: [{ id: "c1", text: "We clean ovens across Malta." }],
    photoStyle: "warm natural light",
  } as unknown as CreativeContext;
  const text = directContext(full, { primary: "#2F45C5", accent: "#FFC83D", heading: "Fraunces", body: "Inter" }, images);
  assert.ok(text.includes("BUSINESS:") && text.includes("THIS POST") && text.includes("ATTACHED IMAGES"));
  assert.ok(text.includes("Image 1: real product photo") && text.includes("Image 2: the brand's logo"));
  assert.ok(text.includes("#2F45C5") && text.includes("Fraunces"));
  assert.ok(text.includes("Oven clean") && text.includes("price 89 EUR") && text.includes("Spotless oven") && text.includes("across Malta") && text.includes("Busy parent") && text.includes("warm natural light"));
  // No instructions about how the picture is made, no labels to cite, no layouts
  assert.ok(!/cite the label|LAYOUTS|\[O1\]|headline|layout/i.test(text), text);
  const prompt = directPrompt(text + '\nContent pillar: One piece (sources: ["A2", "O1"]) (more)');
  assert.ok(prompt.startsWith("Create one new ad image"));
  assert.ok(!prompt.includes("sources:") && prompt.includes("Content pillar: One piece (more)"), "research labels are stripped");
  assert.ok(directPrompt("x".repeat(20000)).length < 12100);
  assert.deepEqual(["1:1", "4:5", "9:16", "16:9"].map(gpt2Resolution), ["2K", "1K", "2K", "2K"]); // Kie's GPT Image 2 has 4:5 only at 1K
  assert.deepEqual(["1:1", "4:5", "9:16", "16:9"].map(openaiImageSize), ["1024x1024", "1088x1360", "1088x1936", "1936x1088"]);
  const brief = directBrief(full, "00000000-0000-4000-8000-000000000001");
  assert.equal(brief.kind, "static");
  assert.equal(Object.keys(brief.captions).sort().join(), ctx.item.platforms.slice().sort().join());
  assert.equal(brief.referenceAssetId, "00000000-0000-4000-8000-000000000001");
});

await check("colourWord and photoWords: colour codes become plain words for the image model", () => {
  assert.equal(colourWord("#ffffff"), "white");
  assert.equal(colourWord("#000"), "black");
  assert.ok(/blue/.test(colourWord("#81a2d0")) && /red/.test(colourWord("#b74737")));
  assert.match(photoWords("Hero shot of [G2] on a #a39161 wall"), /^Hero shot of the reference image on a [a-z ]+ wall$/);
  // pictureOnly itself (used by video) is unchanged: it still drops sentences with colour codes
  assert.equal(pictureOnly("A calm studio. Background #81a2d0 behind her."), "A calm studio.");
});

console.log(`\n${passed} checks passed${process.exitCode ? ", some FAILED" : ""}`);
