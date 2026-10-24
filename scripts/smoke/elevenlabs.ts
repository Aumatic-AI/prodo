import { ai } from "@/providers/ai/registry";
import { smoke } from "./_run";

await smoke("elevenlabs voice", async () => {
  const r = await ai.voice("Prodo is ready.");
  return { result: { bytes: r.data.buffer.length, durationSec: r.data.durationSec, words: r.data.words }, usage: r.usage };
});

await smoke("elevenlabs voices list", async () => {
  const r = await ai.voices({ page_size: 3, page: 0 });
  return { result: r.voices.map((v) => v.name) };
});
