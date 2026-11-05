import type { PresetId } from "@video/presets";
import { PRESETS } from "@video/presets";
import { isVideoStyle, videoSound, videoStyleWeMake, type VideoSound } from "@/core/content/styles";
import { SCENE_LIBRARY, STICKER_NAMES, STORYLINES, type Storyline } from "@/core/creative/video";
import { LIMITS } from "@/core/creative/brief";
import { referenceSound } from "./reference";
import type { Moment } from "@/core/brand/footage";
import type { VideoStyle } from "@/core/onboarding/options";
import { choosePreset } from "@/creative/video/preset";
import type { CreativeContext } from "./context";

// The video part of the Creative Director's fact book: the storyline for the slot's style, the scene
// library it may use, the client's own video moments as [V…] labels, and how the video sounds.

export interface VideoPlan {
  /** The style actually made (talking and customer videos fall back without talking footage) */
  style: VideoStyle;
  storyline: Storyline;
  sound: VideoSound;
  preset: PresetId;
  talkingFootage: boolean;
}

const SOUND_WORDS: Record<VideoSound, string> = {
  music: "MUSIC ONLY: no voice-over. Leave every scene's voiceover empty and give each scene its length in seconds. The pictures, on-screen lines and the caption carry the message.",
  voice: "VOICE ONLY: a voice-over carries the video, with no background music.",
  voice_music: "VOICE AND MUSIC: a voice-over over background music.",
  speech:
    "REAL SPEECH: the person in the talking moments [V…] speaks in their own voice. Talking scenes use those moments with voiceover \"\" (their words are shown as captions). The other scenes are cutaways with no voice-over (voiceover \"\" and seconds set). Soft music underneath.",
};

/** The style, sound and look of a video slot. Older slots without a style are voice-over explainers. */
export function videoPlan(ctx: Pick<CreativeContext, "item" | "moments" | "tone" | "industry" | "reference">): VideoPlan {
  const talkingFootage = ctx.moments.some((m) => m.talking && m.lines.length > 0);
  const picked: VideoStyle = ctx.item.style && isVideoStyle(ctx.item.style) ? ctx.item.style : "faceless";
  const style = videoStyleWeMake(picked, talkingFootage);
  return {
    style,
    storyline: STORYLINES[style],
    // A video made from a reference sounds like it: its own voice and music
    sound: ctx.reference ? referenceSound(ctx.reference, talkingFootage) : videoSound(style, talkingFootage),
    preset: choosePreset(ctx.tone, ctx.industry, style),
    talkingFootage,
  };
}

/** How the slot's video sounds (also used by QA). */
export function slotSound(style: string | null, talkingFootage = false): VideoSound {
  return style && isVideoStyle(style) ? videoSound(style, talkingFootage) : "voice_music";
}

const fmt = (s: number) => `${Math.round(s * 10) / 10}s`;

function momentLine(m: Moment, label: string, offeringId: string | null | undefined): string {
  const traits = [
    `${fmt(m.end - m.start)} ${m.shot}`,
    m.product && (m.offeringId && m.offeringId === offeringId ? "this offering visible" : "product visible"),
    m.people !== "none" && (m.people === "hands" ? "hands only" : m.people === "group" ? "people" : "a person"),
    m.talking && "TALKING to camera",
    `use: ${m.use}`,
    `quality ${m.quality}/5`,
  ].filter(Boolean);
  const said = m.talking && m.lines.length ? ` · says: "${m.lines.map((l) => l.text).join(" ").slice(0, 240)}"` : "";
  return `[${label}] ${traits.join(", ")}: ${m.shows}${said}`;
}

/** Adds the video section to the book; returns the [V…] label map. */
export function videoSection(ctx: CreativeContext, plan: VideoPlan, lines: string[]): Map<string, Moment> {
  const moments = new Map<string, Moment>();
  const s = plan.storyline;
  // A copied video takes its shape from the reference, not from a style
  if (!ctx.reference) lines.push("", `VIDEO STYLE (${plan.style}): ${s.shape}`);
  lines.push('Scene 1 is "hook", the last is "cta". Scene kinds (what a scene is for):');
  for (const [kind, what] of Object.entries(SCENE_LIBRARY)) lines.push(`- ${kind}: ${what}`);
  lines.push(`SOUND: ${SOUND_WORDS[plan.sound]}`);
  if (plan.sound !== "voice" && ctx.rules.musicMood) lines.push(`Music mood chosen by the business owner: ${ctx.rules.musicMood}`);

  if (ctx.moments.length) {
    lines.push(
      "",
      `THE CLIENT'S OWN VIDEO MOMENTS (real footage beats AI: use a [V…] moment whenever one fits the scene; ${s.prefer === "footage" ? "this style is built on them" : "mix them in"})`
    );
    ctx.moments.forEach((m, i) => {
      moments.set(`V${i + 1}`, m);
      lines.push(momentLine(m, `V${i + 1}`, ctx.offering?.id));
    });
  } else if (s.prefer === "footage") {
    lines.push("", "The client has no usable video footage yet: make every scene with AI, taking the product from their real photos [G…] (the scene's \"reference\").");
  }
  if (s.prefer === "photos") lines.push("This style uses the client's REAL PHOTOS [G…] for its scenes; AI only when no photo fits.");

  if (PRESETS[plan.preset].stickers) lines.push("", `STICKERS (an animated emoji at a key word, at most one per scene and three per video, only when it adds meaning): ${STICKER_NAMES.join(", ")}`);
  if (ctx.reference) referenceSection(ctx.reference, lines);
  if (ctx.lessons.length) {
    lines.push("", "VIDEOS THE OWNER LIKES (learn their pacing and structure; never copy their words)");
    ctx.lessons.forEach((l) => lines.push(`- ${l.replace(/\s+/g, " ")}`));
  }
  return moments;
}

/** The reference video, scene by scene, and what to make of it. */
function referenceSection(r: NonNullable<CreativeContext["reference"]>, lines: string[]): void {
  lines.push(
    "",
    "REFERENCE VIDEO (the business owner wants this same video made with their product: everything comes from it except the product, the facts and the brand's words)",
    ...[
      `Length ${fmt(r.duration)}. ${r.summary}`,
      r.format && `Format: ${r.format}`,
      r.pacing && `Pacing: ${r.pacing}`,
      r.look && `Look: ${r.look}`,
      `Sound: voice ${r.sound.voice || "none"}; music ${r.sound.music || "none"}; effects ${r.sound.effects || "none"}`,
      r.captions && `Captions: ${r.captions}`,
      r.ending && `Ending: ${r.ending}`,
      "Scenes:",
    ].filter((l): l is string => !!l)
  );
  r.scenes.forEach((s, i) => {
    const how = [s.purpose, s.shot, s.camera && `camera: ${s.camera}`, s.people && `people: ${s.people}`].filter(Boolean).join(" · ");
    const text = s.onScreenText ? ` · on screen: "${s.onScreenText}"${s.textStyle || s.textPosition ? ` (${[s.textPosition, s.textStyle].filter(Boolean).join(", ")})` : ""}` : "";
    lines.push(`${i + 1}. ${fmt(s.start)}–${fmt(s.end)} (${fmt(s.end - s.start)})${how ? ` · ${how}` : ""}: ${s.shows}${s.action ? `; ${s.action}` : ""}${text}${s.spoken ? ` · said: "${s.spoken}"` : ""}${s.transition ? ` · then: ${s.transition}` : ""}`);
  });
  lines.push(
    `Make this same video for this business: follow it scene by scene, with the same number of scenes, the same length for each, the same kinds of shots, camera moves and actions, the same pacing, the same kind of on-screen lines and the same feel of sound. What it shows becomes this business's product and people, from the REAL PHOTOS and the FACTS; its words are rewritten for this brand, never its brand, logo, names or claims. When it runs longer than ${LIMITS.videoMaxSeconds} seconds, keep its shape within that.`
  );
}
