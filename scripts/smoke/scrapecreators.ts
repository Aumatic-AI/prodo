import { ai } from "@/providers/ai/registry";
import { smoke } from "./_run";

// One Google search (1 credit). Pass an Instagram handle to also read that profile and its posts (2 more).
const handle = process.argv[2];

await smoke("scrapecreators google search", async () => {
  const r = await ai.search.google("specialty coffee roasters", "US");
  return { result: r.data.slice(0, 3), usage: r.usage };
});

if (handle) {
  await smoke("scrapecreators instagram profile", async () => {
    const r = await ai.social.profile("instagram", handle);
    return { result: r.data, usage: r.usage };
  });
  await smoke("scrapecreators instagram posts", async () => {
    const r = await ai.social.posts("instagram", handle, 5);
    return { result: r.data.map((p) => ({ type: p.mediaType, views: p.views, likes: p.likes, video: !!p.videoUrl })), usage: r.usage };
  });
}
