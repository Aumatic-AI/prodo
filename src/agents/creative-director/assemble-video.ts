import { PRESETS } from "@video/presets";
import type { SceneSource } from "@/core/creative/brief";
import type { RawBrief } from "@/prompts/agents/creative-brief";
import type { FactBook } from "./book";
import type { CreativeContext } from "./context";

// The video part of a raw reply → brief scenes: labels become the client's real photos and video
// moments, a stat or review keeps its fact, a price only shows when it is a fact, and the sound
// rules of the slot's style are applied (who speaks, what length each scene has).

const clean = (label: string | null | undefined) => (label ?? "").trim().replace(/^\[|\]$/g, "").toUpperCase();

/** Unspoken scenes: 2–5 seconds unless the brief asked otherwise */
const clampSeconds = (s: number | null) => Math.min(6, Math.max(2, s ?? 3.5));
/** A talking moment plays as recorded, up to this long */
export const MAX_TALKING_SEC = 12;

export function assembleVideoScenes(raw: RawBrief, ctx: CreativeContext, book: FactBook, problems: string[]): { scenes: unknown[]; dropped: number } {
  const plan = book.video!;
  const stickers = PRESETS[plan.preset].stickers;
  let dropped = 0;

  const sourceOf = (label: string | null | undefined, i: number): SceneSource => {
    const l = clean(label);
    if (!l || l === "AI") return { kind: "ai" };
    const moment = book.moment(l);
    if (moment) {
      const keepAudio = plan.sound === "speech" && moment.talking;
      return { kind: "clip", assetId: moment.assetId, start: moment.start, end: keepAudio ? Math.min(moment.end, moment.start + MAX_TALKING_SEC) : moment.end, keepAudio };
    }
    const photo = book.asset(l);
    if (photo) return { kind: "photo", assetId: photo };
    problems.push(`Scene ${i + 1}: "${label}" isn't one of the labels given. Use a V… or G… label, or "AI".`);
    return { kind: "ai" };
  };

  const scenes = raw.scenes.map((s, i) => {
    const source = sourceOf(s.source, i);
    const talking = source.kind === "clip" && source.keepAudio;
    // Who speaks: the made voice-over, the person in the clip, or nobody (music)
    const voiced = (plan.sound === "voice" || plan.sound === "voice_music") && !talking;
    const voiceover = voiced ? s.voiceover : "";
    const seconds = voiced || talking ? null : clampSeconds(s.seconds);

    // A stat or review only with its fact; a price only when the price is a fact
    let stat = null;
    if (s.stat) {
      const ref = book.ref(s.stat.source);
      if (ref && Number.isFinite(s.stat.value)) {
        const decimals = Math.min(2, (String(s.stat.value).split(".")[1] ?? "").length);
        stat = { value: s.stat.value, decimals, prefix: s.stat.prefix, suffix: s.stat.suffix, label: s.stat.label, source: ref };
      } else dropped++;
    }
    const reviewRef = s.review ? book.ref(s.review) : null;
    if (s.review && !reviewRef?.startsWith("proof:")) dropped++;
    const showPrice = s.price && (book.priceLabels.has("O1") || book.priceLabels.has("F1"));

    // Key words must be words the viewer sees or hears in this scene
    const said = `${voiceover} ${s.overlay}`.toLowerCase();
    const keywords = s.keywords.filter((k) => said.includes(k.toLowerCase()));

    return {
      kind: s.kind,
      voiceover,
      seconds,
      overlay: s.overlay,
      keywords,
      visual: s.visual,
      motion: s.motion,
      source,
      revealSource: s.kind === "reveal" ? sourceOf(s.reveal, i) : null,
      revealVisual: s.kind === "reveal" ? (s.revealVisual ?? "") : "",
      sticker: stickers ? s.sticker : null,
      stat: s.kind === "stat" ? stat : null,
      proofId: s.kind === "review" && reviewRef?.startsWith("proof:") ? reviewRef.slice("proof:".length) : null,
      showPrice,
      transition: s.transition,
    };
  });
  return { scenes, dropped };
}
