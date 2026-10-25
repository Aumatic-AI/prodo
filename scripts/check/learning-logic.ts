// Offline checks of the Performance Analyst's maths (agent 10). No vendors, no database.
// Run: npm run smoke scripts/check/learning-logic.ts
import assert from "node:assert/strict";
import { baselines, confidence, engagementRate, groupLearnings, hourSlot, median, scorePost, REJECTED_SCORE, REJECTED_WEIGHT } from "@/agents/performance-analyst/score";
import { tagsOf } from "@/agents/performance-analyst/data";

let passed = 0;
const check = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

const m = (o: Partial<Parameters<typeof engagementRate>[0]>) => ({ impressions: null, reach: null, views: null, likes: null, comments: null, shares: null, saves: null, engagement_rate: null, ...o });

check("engagementRate: provider rate wins; percentages become fractions", () => {
  assert.equal(engagementRate(m({ engagement_rate: 0.05, reach: 100, likes: 1 })), 0.05);
  assert.equal(engagementRate(m({ engagement_rate: 4.2 })), 0.042);
});

check("engagementRate: engagements ÷ reach, then impressions, then views; null without a base", () => {
  assert.equal(engagementRate(m({ reach: 200, likes: 6, comments: 2, shares: 1, saves: 1 })), 0.05);
  assert.equal(engagementRate(m({ impressions: 1000, likes: 10 })), 0.01);
  assert.equal(engagementRate(m({ likes: 10 })), null);
});

check("median: odd, even, empty", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
});

check("baselines: own median from 10+ posts, else research, else platform default", () => {
  const own = Array.from({ length: 10 }, (_, i) => ({ platform: "instagram", er: 0.01 + i * 0.002, views: 100 + i }));
  const few = [{ platform: "linkedin", er: 0.5, views: null }];
  const b = baselines([...own, ...few], { linkedin: { er: 0.03 } });
  assert.equal(b.instagram.from, "own");
  assert.equal(Math.round(b.instagram.er * 1000) / 1000, 0.019);
  assert.equal(b.linkedin.from, "research");
  assert.equal(b.linkedin.er, 0.03);
  const d = baselines([{ platform: "tiktok", er: 0.1, views: 50 }], {});
  assert.equal(d.tiktok.from, "default");
});

check("scorePost: rate ÷ baseline, views fallback, capped at 5", () => {
  const base = { er: 0.02, views: 1000, sample: 12, from: "own" as const };
  assert.equal(scorePost(0.03, null, base), 1.5);
  assert.equal(scorePost(null, 500, base), 0.5);
  assert.equal(scorePost(1, null, base), 5);
  assert.equal(scorePost(null, null, base), null);
});

check("groupLearnings: weighted means overall and per platform, rejections at half weight", () => {
  const items = [
    { score: 2, weight: 1, platform: "instagram", tags: [{ dimension: "format" as const, value: "video" }] },
    { score: 1, weight: 1, platform: "instagram", tags: [{ dimension: "format" as const, value: "video" }] },
    { score: REJECTED_SCORE, weight: REJECTED_WEIGHT, platform: "facebook", tags: [{ dimension: "format" as const, value: "video" }] },
  ];
  const out = groupLearnings(items);
  const all = out.find((l) => l.platform === null)!;
  assert.equal(all.sample_size, 3);
  assert.equal(all.score, Math.round(((2 + 1 + 0.3) / 2.5) * 100) / 100);
  assert.equal(out.find((l) => l.platform === "instagram")!.score, 1.5);
});

check("confidence grows with posts", () => {
  assert.equal(confidence(5), 0.5);
  assert.ok(confidence(20) > confidence(10));
});

check("hourSlot: local hour of the post", () => {
  assert.equal(hourSlot("2026-11-02T12:40:00Z", "Asia/Kolkata"), "18:00");
  assert.equal(hourSlot("2026-11-02T23:10:00Z", "UTC"), "23:00");
});

check("tagsOf: plan tags, manual posts get format and time only", () => {
  const item = { id: "i", angle: "3 sofa mistakes", hook_type: "mistake", hook_text: "Stop", format: "carousel", framework: "pas", levers: ["value", "curiosity"], pillar_id: "p", persona_id: "q" };
  const tags = tagsOf(item, "carousel", "2026-11-02T09:00:00Z", "UTC");
  assert.deepEqual(tags.map((t) => t.dimension).sort(), ["angle", "format", "framework", "hook_type", "lever", "lever", "persona", "pillar", "time_slot"]);
  const manual = tagsOf(null, "image", "2026-11-02T09:00:00Z", "UTC");
  assert.deepEqual(manual, [
    { dimension: "time_slot", value: "09:00" },
    { dimension: "format", value: "static" },
  ]);
});

console.log(`\n${passed} checks passed${process.exitCode ? ", some FAILED" : ""}`);
