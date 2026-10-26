// Offline checks of the research agents' pure logic. No vendor calls, no database.
import assert from "node:assert/strict";
import sharp from "sharp";
import { rankPages, cleanMarkdown } from "@/agents/website-analyst/rank-pages";
import { chunkText } from "@/agents/research/brain";
import { nameKey, sameName } from "@/agents/research/text";
import { contrast, parseColor } from "@/lib/color";
import { readDesign } from "@/agents/visual-identity/css";
import { pickColors } from "@/agents/visual-identity/palette";
import { analyzeLogo } from "@/agents/visual-identity/logo";
import { scorePosts, splitTopBottom, median } from "@/agents/social-market/baseline";
import { handleFromUrl, domainOf } from "@/providers/social/handles";
import { findSocialLinks } from "@/agents/social-market/website-socials";
import { pageFactsSchema } from "@/prompts/agents/website-facts";
import type { SocialPost } from "@/providers/social/types";
import { assembleBible, normaliseShares, usesBannedWord } from "@/agents/brand-strategist/checks";
import { buildSourceBook } from "@/agents/brand-strategist/sources";
import type { StrategistInput } from "@/agents/brand-strategist/inputs";
import { audienceSchema, bibleCoreSchema } from "@/prompts/agents/brand-bible";
import { bibleContentSchema } from "@/core/brand/bible";
import { resourceSchema } from "@/core/brand/resources";
import { readablePairs } from "@/lib/color";

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

await check("rankPages: home first, skips cart/legal/other hosts, caps detail pages, dedupes", () => {
  const links = [
    "https://acme.com/cart", "https://acme.com/privacy-policy", "https://other.com/products", "http://www.acme.com/about/",
    "https://acme.com/about", "https://acme.com/blog/post-1", "https://acme.com/products", "https://acme.com/pricing", "https://acme.com/logo.png",
    ...Array.from({ length: 20 }, (_, i) => `https://acme.com/products/item-${i}`),
  ].map((url) => ({ url }));
  const picked = rankPages("https://acme.com", links, 30);
  assert.equal(picked[0], "https://acme.com");
  assert.ok(!picked.some((u) => /cart|privacy|other\.com|logo\.png/.test(u)));
  assert.equal(picked.filter((u) => /about/.test(u)).length, 1);
  assert.equal(picked.filter((u) => /products\/item/.test(u)).length, 12);
  assert.ok(picked.indexOf("https://acme.com/products") < picked.indexOf("https://acme.com/blog/post-1"));
});

await check("cleanMarkdown drops images and blank runs", () => {
  assert.equal(cleanMarkdown("Hi ![x](a.png)\n\n\n\n[](b)There"), "Hi\n\nThere");
});

await check("chunkText: ~500-word chunks with overlap, nothing lost", () => {
  const words = Array.from({ length: 1300 }, (_, i) => `w${i}`);
  const chunks = chunkText(words.join(" "));
  assert.ok(chunks.length >= 3 && chunks.length <= 4, `got ${chunks.length}`);
  assert.ok(chunks.every((c) => c.split(" ").length <= 500));
  assert.ok(chunks.at(-1)!.includes("w1299"));
  assert.ok(chunks[1].startsWith("w420"), chunks[1].slice(0, 10));
  assert.deepEqual(chunkText("short text"), ["short text"]);
});

await check("nameKey matches names written differently", () => {
  assert.equal(nameKey("Blue Mug (12oz)"), nameKey("blue mug 12 OZ"));
  assert.notEqual(nameKey("Blue Mug"), nameKey("Red Mug"));
});

await check("colours: parse and WCAG contrast", () => {
  assert.equal(parseColor("#ABC"), "#aabbcc");
  assert.equal(parseColor("rgb(255, 0, 0)"), "#ff0000");
  assert.equal(parseColor("rgba(0,0,0,0.1)"), null);
  assert.equal(Math.round(contrast("#ffffff", "#000000")), 21);
  assert.ok(contrast("#ffffff", "#777777") < 4.5);
});

await check("readDesign: brand variables, fonts by selector and Google Fonts", () => {
  const css = `:root{--brand-primary:#e63946;--gray:#f1f1f1} body{font-family:"Inter",sans-serif;color:#1d1d1f;background:#ffffff}
    h1,h2{font-family:'Playfair Display',serif} .btn{background-color:#e63946} .x{color:#457b9d}`;
  const d = readDesign(css, ["https://fonts.googleapis.com/css2?family=Inter:wght@400&family=Playfair+Display:wght@700"]);
  assert.equal(d.colors[0].hex, "#e63946");
  assert.ok(d.colors[0].brand);
  assert.equal(d.fonts.body, "Inter");
  assert.equal(d.fonts.heading, "Playfair Display");
});

await check("pickColors: brand colour first, every pair readable", () => {
  const c = pickColors(["#2a9d8f"], [
    { hex: "#e63946", count: 3, brand: true },
    { hex: "#ffffff", count: 10, brand: false },
    { hex: "#1d1d1f", count: 8, brand: false },
  ]);
  assert.equal(c.primary, "#e63946");
  assert.equal(c.secondary, "#2a9d8f");
  assert.equal(c.bg, "#ffffff");
  assert.ok(c.pairs.length >= 3);
  assert.ok(c.pairs.every((p) => contrast(p.bg, p.text) >= 4.5));
});

await check("analyzeLogo: palette, transparency and brightness from a real PNG", async () => {
  const size = 100;
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const inShape = i % size > 20 && i % size < 80;
    pixels.set(inShape ? [230, 57, 70, 255] : [0, 0, 0, 0], i * 4);
  }
  const png = await sharp(pixels, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
  const a = await analyzeLogo(png);
  assert.ok(a.transparent);
  assert.ok(a.palette.length >= 1, "palette");
  assert.ok(a.brightness > 0.1 && a.brightness < 0.5, String(a.brightness));
});

const post = (i: number, views: number, likes: number, type: SocialPost["mediaType"] = "video"): SocialPost => ({
  id: String(i), platform: "instagram", mediaType: type, views, likes, comments: 0, shares: 0, saves: 0, caption: `post ${i}`,
});

await check("baseline: median per view, scores, top and bottom 20%", () => {
  const posts = Array.from({ length: 10 }, (_, i) => post(i, 1000, (i + 1) * 10, i % 2 ? "image" : "video"));
  const { baseline, posts: scored } = scorePosts("instagram", posts, 5000);
  assert.equal(baseline.per, "view");
  assert.equal(baseline.sampleSize, 10);
  assert.equal(baseline.medianEngagement, median([10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((n) => n / 1000)));
  assert.ok(baseline.confidence >= 0.5);
  const { top, bottom } = splitTopBottom(scored);
  assert.equal(top.length, 2);
  assert.equal(top[0].id, "9");
  assert.equal(bottom[0].id, "0");
  assert.ok(baseline.byFormat.video && baseline.byFormat.image);
});

await check("baseline: under 10 posts falls back to platform default, low confidence", () => {
  const { baseline } = scorePosts("tiktok", [post(1, 100, 5)], null);
  assert.equal(baseline.medianEngagement, 0.04);
  assert.equal(baseline.confidence, 0.2);
});

await check("handles and domains from pasted links", () => {
  assert.equal(handleFromUrl("instagram", "https://www.instagram.com/acme.co/"), "acme.co");
  assert.equal(handleFromUrl("instagram", "@acme"), "acme");
  assert.equal(handleFromUrl("instagram", "https://instagram.com/p/XYZ"), null);
  assert.equal(handleFromUrl("tiktok", "https://www.tiktok.com/@acme"), "acme");
  assert.equal(handleFromUrl("youtube", "https://youtube.com/@AcmeTV"), "AcmeTV");
  assert.equal(domainOf("https://www.acme.co.uk/shop"), "acme.co.uk");
});

await check("page facts schema keeps good items and drops bad ones", () => {
  const parsed = pageFactsSchema.parse({
    offerings: [{ kind: "product", name: "Mug", price: 12, currency: "usd", benefits: ["Big"] }, { kind: "thing", name: "Bad" }],
    offers: [{ title: "10% off", endsAt: "next week" }],
  });
  assert.equal(parsed.offerings.length, 1);
  assert.equal(parsed.offerings[0].currency, "USD");
  assert.equal(parsed.offers[0].endsAt, null);
  assert.deepEqual(parsed.proof, []);
});

await check("readDesign: CSS variables (Next.js / Tailwind), fallback and code fonts", () => {
  const css =
    ':root{--font-geist-sans:"Geist","Geist Fallback";--font-sans:var(--font-geist-sans),ui-sans-serif;--font-display:"Fraunces",serif;--font-mono:ui-monospace,SFMono-Regular}' +
    ' html,:host{font-family:var(--font-mono)} body{font-family:var(--font-sans)} .font-display{font-family:var(--font-display)} @font-face{font-family:"Geist Fallback";src:local("Arial")}';
  const d = readDesign(css, []);
  assert.equal(d.fonts.body, "Geist");
  assert.equal(d.fonts.heading, "Fraunces");
  assert.ok(!d.fonts.all.some((f) => /fallback|emoji/i.test(f)));
});

await check("sameName: wording differences match, different things don't", () => {
  assert.ok(sameName("Lead gen & outreach", "Lead Gen & Outreach Automation"));
  assert.ok(sameName("SPC floors", "SPC Flooring"));
  assert.ok(sameName("Teeth Whitening", "teeth whitening"));
  assert.ok(!sameName("Decking", "Decking Boards"), "one-word names only match exactly");
  assert.ok(!sameName("Porcelain Tiles", "Vinyl Parquet"));
  assert.ok(!sameName("Voice AI Agents", "Multi-agent AI Systems"));
});

// ---------- Brand Strategist (1.9) ----------

const input: StrategistInput = {
  businessName: "Bean There",
  language: "en",
  answers: { description: "Specialty coffee roaster in Valletta", goal: "sales", market: "", tone: "casual", liked_brands: "", rules: "Never use: cheap", faqs: "", area: "" },
  offerings: [
    { id: "11111111-1111-4111-8111-111111111111", name: "House Blend", kind: "product", price: 12, currency: "EUR", benefits: [], audience: null, isHero: true, pending: false },
    { id: "22222222-2222-4222-8222-222222222222", name: "Cold Brew", kind: "product", price: null, currency: null, benefits: [], audience: null, isHero: false, pending: true },
  ],
  proof: [{ id: "33333333-3333-4333-8333-333333333333", kind: "review", content: "Best flat white in town", author: "Maria" }],
  kit: "Brand colours: #6b3e26",
  marketNotes: ["Competitor X: gaps: no subscriptions"],
  winningHooks: [],
  avoidWords: ["cheap"],
};
const passages = [{ id: "44444444-4444-4444-8444-444444444444", text: "We roast every Monday in small batches.", title: null }];

await check("source book: labels map to real refs, market notes can't be cited", () => {
  const book = buildSourceBook(input, passages);
  assert.ok(book.text.includes("[A1]") && book.text.includes("[O2]") && book.text.includes("[R1]") && book.text.includes("[C1]") && book.text.includes("[K]"));
  assert.deepEqual(book.toRefs(["A1", "[C1]", "o1", "M1", "Z9"]), [
    "answer:description",
    "chunk:44444444-4444-4444-8444-444444444444",
    "offering:11111111-1111-4111-8111-111111111111",
  ]);
  assert.equal(book.offering("O2")?.pending, true);
});

await check("never-say: whole words only, any case", () => {
  assert.ok(usesBannedWord("Not CHEAP at all", ["cheap"]));
  assert.ok(!usesBannedWord("Cheapside market", ["cheap"]));
  assert.ok(usesBannedWord("guaranteed results", ["guaranteed results"]));
});

await check("pillar shares add up to exactly 1", () => {
  const shares = normaliseShares([30, 30, 20, 15, 4]);
  assert.equal(Math.round(shares.reduce((a, b) => a + b, 0) * 1000), 1000);
  assert.deepEqual(normaliseShares([0, 0, 0, 0]), [0.25, 0.25, 0.25, 0.25]);
});

const claim = (text: string, sources: string[]) => ({ text, sources });
const persona = (name: string, sources: string[]) => ({ name, summary: "s", pains: [], desires: [], objections: [], triggers: [], phrases: [], sources });

await check("assembleBible: drops unsourced or banned claims, keeps the offer stack, checks counts", () => {
  const book = buildSourceBook(input, passages);
  const core = bibleCoreSchema.parse({
    positioning: claim("Small-batch roaster for Valletta locals", ["A1", "C1"]),
    valueProp: claim("Fresh coffee every week", ["C1"]),
    tone: { summary: claim("Casual and warm", ["A4"]), traits: [claim("Friendly", ["A4"]), claim("Made up", [])], examples: ["Hey there!"] },
    visualRules: [claim("Warm brown tones", ["K"])],
    offerStack: [
      { offering: "O1", role: "hero", pitch: claim("Our everyday favourite", []) },
      { offering: "O9", role: "core", pitch: claim("x", ["A1"]) },
    ],
    do: [claim("Show the roaster", ["C1"])],
    dont: [claim("Never look cheap", ["A1"])],
    neverSay: ["discount"],
  });
  const audience = audienceSchema.parse({
    personas: [persona("Local regular", ["A1"]), persona("Tourist", ["C1"]), persona("Home brewer", ["O1"]), persona("No source", [])],
    pillars: [1, 2, 3, 4, 5, 6].map((n) => ({ name: `P${n}`, description: "d", share: 20, funnelStage: "tofu", examples: [] })),
  });
  const { content, dropped } = assembleBible(core, audience, book, input.avoidWords, null);
  assert.equal(content.tone_guide.traits.length, 1);
  assert.equal(content.do_dont.dont.length, 0, "banned word removed");
  assert.equal(content.offer_stack.length, 1, "unknown O9 skipped; O1's pitch is backed by the offering itself");
  assert.equal(content.personas.length, 3);
  assert.equal(content.pillars.length, 5);
  assert.deepEqual(content.never_say, ["cheap", "discount"]);
  assert.ok(dropped >= 3);
  assert.ok(bibleContentSchema.safeParse(content).success, "matches the stored Bible schema");
});

await check("assembleBible: too few personas is a retryable error", () => {
  const book = buildSourceBook(input, passages);
  const core = bibleCoreSchema.parse({ positioning: claim("p", ["A1"]), valueProp: claim("v", ["A1"]), tone: { summary: claim("t", ["A1"]) } });
  const audience = audienceSchema.parse({ personas: [persona("One", ["A1"])], pillars: [] });
  assert.throws(() => assembleBible(core, audience, book, [], null), /too few personas/);
});

// ---------- Brand Hub (1.10) ----------

await check("resource schemas: required fields, links, percent, unknown fields", () => {
  assert.ok(!resourceSchema("offerings", "create").safeParse({ kind: "product" }).success, "name required");
  assert.ok(resourceSchema("offerings", "create").safeParse({ name: "Mug", kind: "product", price: 12, url: "https://a.co/mug", benefits: ["Big"] }).success);
  assert.ok(!resourceSchema("offerings", "update").safeParse({ url: "a.co" }).success, "link needs https://");
  assert.ok(!resourceSchema("pillars", "update").safeParse({ target_share: 40 }).success, "share is 0–1");
  assert.ok(!resourceSchema("competitors", "update").safeParse({ source: "client" }).success, "unknown fields rejected");
});

await check("brand kit pairs are recomputed and readable", () => {
  const pairs = readablePairs(
    [
      ["primary", "#0078d4"],
      ["bg", "#ffffff"],
      ["accent", "#ffd400"],
    ],
    ["#ffffff", "#111111"]
  );
  assert.equal(pairs.find((p) => p.name === "accent")?.text, "#111111");
  assert.ok(pairs.every((p) => p.ratio >= 4.5));
});

await check("findSocialLinks: profile links from a footer, not share buttons or posts", () => {
  const html = `
    <a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a>
    <a href="https://twitter.com/intent/tweet?text=hi">Tweet</a>
    <a href="https://www.instagram.com/p/C123abc/">A post</a>
    <footer>
      <a href="https://www.instagram.com/repeatless.official/?utm_source=site">IG</a>
      <a href='https://m.facebook.com/Repeatless/'>FB</a>
      <a href="https://www.linkedin.com/company/repeatless">in</a>
      <a href="https://www.youtube.com/@repeatless">YT</a>
      <a href="https://www.tiktok.com/@repeatless">TT</a>
      <a href="https://x.com/repeatless">X</a>
      <a href="/about">About</a>
    </footer>`;
  const links = findSocialLinks(html);
  assert.equal(links.instagram, "https://instagram.com/repeatless.official");
  assert.equal(links.facebook, "https://facebook.com/Repeatless");
  assert.equal(links.linkedin, "https://linkedin.com/company/repeatless");
  assert.equal(links.youtube, "https://youtube.com/@repeatless");
  assert.equal(links.tiktok, "https://tiktok.com/@repeatless");
  assert.equal(links.twitter, "https://x.com/repeatless");
  assert.equal(links.pinterest, undefined);
  assert.equal(handleFromUrl("instagram", links.instagram), "repeatless.official");
});

console.log(`\n${passed} checks passed`);
