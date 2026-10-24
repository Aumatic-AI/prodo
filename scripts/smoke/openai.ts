import { z } from "zod";
import { ai } from "@/providers/ai/registry";
import { smoke } from "./_run";

await smoke("openai text", async () => {
  const r = await ai.text("Reply with the single word: ready");
  return { result: r.data, usage: r.usage };
});

await smoke("openai structured", async () => {
  const r = await ai.structured(z.object({ colors: z.array(z.string()) }), 'Return JSON {"colors": [three colour names]}');
  return { result: r.data, usage: r.usage };
});

await smoke("openai embed", async () => {
  const r = await ai.embed(["Neighbourhood café for students"]);
  return { result: { vectors: r.data.length, dimensions: r.data[0]?.length }, usage: r.usage };
});
