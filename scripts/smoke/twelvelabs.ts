import { ai } from "@/providers/ai/registry";
import { smoke } from "./_run";

// A short public sample video; pass your own MP4 URL to test with it instead
const videoUrl = process.argv[2] ?? "https://download.samplelib.com/mp4/sample-5s.mp4";

await smoke("twelvelabs analyse", async () => {
  const r = await ai.analyzeVideo(videoUrl, 'Describe the hook in the first 3 seconds. Return JSON {"hook": string, "pacing": "slow" | "medium" | "fast"}', {
    type: "object",
    properties: { hook: { type: "string" }, pacing: { type: "string", enum: ["slow", "medium", "fast"] } },
    required: ["hook", "pacing"],
  });
  return { result: r.data, usage: r.usage };
});
