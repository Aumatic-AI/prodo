import { publisherFor } from "@/providers/publishing/registry";
import { analyticsFor } from "@/providers/analytics/registry";
import { businessDb } from "@/lib/supabase/business";
import { smoke, smokeBusinessId } from "./_run";

// Read-only: lists one business's accounts and their past posts. Publishing is tested from the app.
const db = businessDb(await smokeBusinessId());

await smoke("zernio accounts", async () => ({ result: await publisherFor("zernio").listAccounts(db) }));

await smoke("zernio past posts", async () => {
  const [account] = await publisherFor("zernio").listAccounts(db);
  if (!account) return { result: "No connected accounts" };
  const posts = await analyticsFor("zernio").listPastPosts(account.id, 5);
  return { result: posts.map((p) => ({ id: p.providerPostId, url: p.url, media: p.mediaUrls.length, metrics: p.metrics.likes })) };
});
