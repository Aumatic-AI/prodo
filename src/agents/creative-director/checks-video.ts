import { countWords, LIMITS, spokenSeconds, type VideoBrief } from "@/core/creative/brief";
import { isVideoStyle } from "@/core/content/styles";
import { STORYLINES } from "@/core/creative/video";
import type { CreativeContext } from "./context";

// Code checks on a video brief (no AI): the storyline's shape, timing for each kind of sound, real
// footage that fits its scene, numbers that come from their fact. Each problem is a plain
// instruction the Creative Director gets back.

/** A real clip may be slowed to this rate to cover a longer line; shorter than that doesn't fit */
const MIN_CLIP_RATE = 0.7;

/** The text of the fact a stored ref points at, to check a stat's number against. */
function factText(ref: string, ctx: CreativeContext): string {
  const [kind, id] = ref.split(":");
  if (kind === "proof") return ctx.proof.find((p) => p.id === id)?.content ?? "";
  if (kind === "offer" && ctx.offer?.id === id) return [ctx.offer.title, ctx.offer.details].join(" ");
  if (kind === "offering" && ctx.offering?.id === id) {
    const o = ctx.offering;
    return [o.price ?? "", o.description, o.benefits.join(" "), o.objections.join(" ")].join(" ");
  }
  if (kind === "chunk") return ctx.passages.find((p) => p.id === id)?.text ?? "";
  return "";
}

const numbersIn = (text: string) => [...text.replace(/,/g, "").matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

/** Seconds the scene will last, as the producer will make it. */
export function plannedSeconds(scene: VideoBrief["scenes"][number]): number {
  if (scene.source.kind === "clip" && scene.source.keepAudio) return scene.source.end - scene.source.start;
  if (scene.voiceover) return spokenSeconds(scene.voiceover) + 0.35;
  return scene.seconds ?? 3.5;
}

export function checkVideoBrief(brief: VideoBrief, ctx: CreativeContext): string[] {
  const problems: string[] = [];
  const scenes = brief.scenes;
  const storyline = STORYLINES[brief.style && isVideoStyle(brief.style) ? brief.style : "faceless"];

  // The storyline's shape
  if (scenes.length < storyline.minScenes || scenes.length > storyline.maxScenes) problems.push(`Use ${storyline.minScenes}–${storyline.maxScenes} scenes (now ${scenes.length}).`);
  if (scenes[0]?.kind !== "hook") problems.push('Scene 1 must be kind "hook".');
  if (scenes.at(-1)?.kind !== "cta") problems.push('The last scene must be kind "cta".');
  scenes.slice(1, -1).forEach((s, i) => {
    if (!storyline.middle.includes(s.kind)) problems.push(`Scene ${i + 2} is "${s.kind}", which this style doesn't use. Use one of: ${storyline.middle.join(", ")}.`);
  });
  if (!scenes[0]?.overlay.trim()) problems.push("The hook scene needs its on-screen line (overlay).");

  // Words on screen and spoken
  scenes.forEach((s, i) => {
    if (countWords(s.overlay) > LIMITS.overlayWords) problems.push(`Scene ${i + 1}'s on-screen line has ${countWords(s.overlay)} words; keep it to ${LIMITS.overlayWords} or fewer.`);
    const sec = spokenSeconds(s.voiceover);
    if (sec > 8.5) problems.push(`Scene ${i + 1}'s voice-over takes about ${Math.round(sec)} seconds to say; keep each scene under 8 seconds.`);
  });
  const voiced = brief.sound === "voice" || brief.sound === "voice_music";
  if (voiced) {
    scenes.forEach((s, i) => {
      const talking = s.source.kind === "clip" && s.source.keepAudio;
      if (!talking && s.voiceover.trim().length < 2) problems.push(`Scene ${i + 1} needs a voice-over line.`);
    });
  }
  if (brief.sound === "speech" && !scenes.some((s) => s.source.kind === "clip" && s.source.keepAudio)) {
    problems.push("This video is built on someone talking: use at least one TALKING moment [V…] from the client's videos.");
  }
  scenes.forEach((s, i) => {
    if (s.kind === "talking" && !(s.source.kind === "clip" && s.source.keepAudio)) problems.push(`Scene ${i + 1} is "talking" but its source isn't a talking moment [V…].`);
  });

  // Total length (the closing card adds its own seconds)
  const total = scenes.reduce((sum, s) => sum + plannedSeconds(s), 0);
  if (total > 40) problems.push(`The video runs about ${Math.round(total)} seconds; keep it under 35.`);
  if (total < 10) problems.push(`The video is only about ${Math.round(total)} seconds; aim for 15–35.`);

  // Real footage must be long enough for its scene, and used once
  const used = new Set<string>();
  scenes.forEach((s, i) => {
    const src = s.source;
    if (src.kind === "ai") return;
    const key = src.kind === "clip" ? `${src.assetId}@${src.start}` : src.assetId;
    if (used.has(key)) problems.push(`Scene ${i + 1} repeats a picture already used; pick a different one.`);
    used.add(key);
    if (src.kind === "clip" && !src.keepAudio) {
      const needed = plannedSeconds(s);
      const length = src.end - src.start;
      if (length < needed * MIN_CLIP_RATE) problems.push(`Scene ${i + 1}'s moment is ${Math.round(length * 10) / 10}s but the scene needs about ${Math.round(needed)}s: shorten the line or pick a longer moment.`);
    }
  });
  if (storyline.prefer === "photos" && ctx.assets.length >= 3 && scenes.filter((s) => s.kind !== "cta" && s.source.kind === "ai").length > 1) {
    problems.push("This style is built on the client's real photos: use G… photos for the scenes, AI only when nothing fits.");
  }

  // Numbers come from their fact
  scenes.forEach((s, i) => {
    if (s.kind === "stat" && !s.stat) problems.push(`Scene ${i + 1} is a "stat" scene without a stat from a fact; give one, or change the scene's kind.`);
    if (s.stat && !numbersIn(factText(s.stat.source, ctx)).includes(s.stat.value)) problems.push(`Scene ${i + 1}'s number ${s.stat.value} isn't in the fact it cites; use a number from that fact.`);
    if (s.kind === "review" && !s.proofId) problems.push(`Scene ${i + 1} is a "review" scene without a review label [R…].`);
    if (s.kind === "reveal" && !s.revealSource) problems.push(`Scene ${i + 1} is a "reveal" without the after picture ("reveal").`);
  });
  if (scenes.filter((s) => s.sticker).length > 3) problems.push("Use at most 3 stickers in the video.");
  return problems;
}
