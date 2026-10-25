import { ai } from "@/providers/ai/registry";
import { smoke } from "./_run";

const site = process.argv[2] ?? "https://example.com";

await smoke("firecrawl map", async () => {
  const r = await ai.crawl.map(site, 20);
  return { result: r.data.slice(0, 10), usage: r.usage };
});

await smoke("firecrawl scrape", async () => {
  const r = await ai.crawl.scrape(site);
  return { result: { url: r.data.url, title: r.data.title, chars: r.data.markdown.length }, usage: r.usage };
});
