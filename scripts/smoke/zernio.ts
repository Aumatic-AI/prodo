import { publisherFor } from "@/providers/publishing/registry";
import { analyticsFor } from "@/providers/analytics/registry";
import { smoke } from "./_run";

// Read-only: lists accounts and their past posts. Publishing is tested from the app.
await smoke("zernio accounts", async () => ({ result: await publisherFor("zernio").listAccounts() }));

await smoke("zernio past posts", async () => {
  const [account] = await publisherFor("zernio").listAccounts();
  if (!account) return { result: "No connected accounts" };
  const posts = await analyticsFor("zernio").listPastPosts(account.id, 5);
  return { result: posts.map((p) => ({ id: p.providerPostId, url: p.url, media: p.mediaUrls.length, metrics: p.metrics.likes })) };
});
