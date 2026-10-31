// Puts the video sound effects in our storage (shared/sfx/<name>.wav). Run once per bucket. Free.
// - whoosh, swish, click, shutter: Remotion's sound effects released under CC0 (remotion.media)
// - pop, ding, rise: made here from plain tones, so they're ours
// Usage: npm run smoke scripts/setup/sfx.ts
import { sfxKey } from "@/providers/storage/paths";
import { upload } from "@/providers/storage/r2";

const CC0: Record<string, string> = {
  whoosh: "https://remotion.media/whoosh.wav",
  swish: "https://remotion.media/whip.wav",
  click: "https://remotion.media/mouse-click.wav",
  shutter: "https://remotion.media/shutter-modern.wav",
};

const RATE = 44100;

/** 16-bit mono WAV from samples in -1…1. */
function wav(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

function make(seconds: number, fn: (t: number) => number): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i++) out[i] = fn(i / RATE);
  // Peak at -3 dB, like Remotion's sounds
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  return out.map((v) => (v / peak) * 0.708);
}

// A soft bubble pop: a quick downward pitch sweep with a fast decay
const pop = make(0.12, (t) => {
  const f = 900 * Math.exp(-t * 18) + 260;
  return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 38) * Math.min(1, t * 900);
});

// A bright bell: a few partials with long, staggered decays
const ding = make(1.2, (t) => {
  const partials: [number, number, number][] = [[1568, 1, 3.2], [3136, 0.45, 4.5], [4718, 0.22, 6], [6290, 0.1, 8]];
  return partials.reduce((s, [f, a, d]) => s + a * Math.sin(2 * Math.PI * f * t) * Math.exp(-t * d), 0) * Math.min(1, t * 400);
});

// A riser: a rising tone with a breath of noise, swelling into the reveal
let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const rise = make(1.1, (t) => {
  const p = t / 1.1;
  const f = 180 + 900 * p * p;
  return (Math.sin(2 * Math.PI * f * t) * 0.6 + noise() * 0.25 * p) * p * p * (p < 0.97 ? 1 : (1 - p) / 0.03);
});

for (const [name, url] of Object.entries(CC0)) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  await upload(sfxKey(name), Buffer.from(await res.arrayBuffer()), "audio/wav");
  console.log("saved", sfxKey(name), "(CC0, Remotion)");
}
for (const [name, samples] of Object.entries({ pop, ding, rise })) {
  await upload(sfxKey(name), wav(samples), "audio/wav");
  console.log("saved", sfxKey(name), "(made here)");
}
