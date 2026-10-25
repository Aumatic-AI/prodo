import type { SupabaseClient } from "@supabase/supabase-js";
import { platformMeta } from "@/config/platforms";
import { AppError } from "@/core/errors";
import { createPost } from "@/core/posts";
import { getItem, updateItem } from "@/core/plans/plans";
import type { Brief } from "@/core/creative/brief";
import { publisherFor } from "@/providers/publishing/registry";
import type { ConnectedAccount } from "@/providers/publishing/types";

// Turns an approved slot into a scheduled post: one target per connected account on the slot's
// platforms, each with its own caption, at the slot's time (or soon, when that time has passed).
// The publish-post job then sends it to Zernio.

/** Platforms where a plain link in the caption works */
const LINK_PLATFORMS = ["facebook", "linkedin", "twitter", "youtube"];
const MIN_LEAD_MS = 10 * 60_000;

export interface Scheduled {
  postId: string | null;
  publishAt: string | null;
  platforms: string[];
  /** Platforms with no connected account */
  missing: string[];
}

function captionFor(platform: string, caption: string, link: string | null): string {
  if (!link || !LINK_PLATFORMS.includes(platform) || caption.includes(link)) return caption;
  const max = platformMeta(platform).captionMaxLength;
  const withLink = `${caption}\n\n${link}`;
  return withLink.length <= max ? withLink : caption;
}

export async function scheduleItem(db: SupabaseClient, itemId: string, accounts?: ConnectedAccount[]): Promise<Scheduled> {
  const item = await getItem(db, itemId);
  if (item.status !== "approved") throw new AppError("Only approved posts are scheduled.", "INVALID_INPUT", false);
  if (!item.selected_media_id) throw new AppError("This post has no finished media.", "INVALID_INPUT", false);

  const { data: existing } = await db.from("posts").select("id, publish_at").eq("plan_item_id", itemId).maybeSingle();
  if (existing) {
    await updateItem(db, itemId, { status: "scheduled", error: null });
    return { postId: existing.id, publishAt: existing.publish_at, platforms: item.platforms, missing: [] };
  }

  const list = accounts ?? (await publisherFor().listAccounts());
  const brief = item.brief as Brief | null;
  const { data: profile } = await db.from("business_profile").select("website, cta_links").eq("id", 1).single();
  const links: Record<string, string> = { website: profile?.website ?? "", ...(profile?.cta_links ?? {}) };
  const link = brief ? links[brief.cta.link] || links.website || null : null;

  const targets = item.platforms.flatMap((platform) =>
    list
      .filter((a) => a.platform === platform || (platform === "twitter" && a.platform === "x"))
      .map((a) => ({
        platform,
        account_id: a.id,
        account_name: a.name,
        caption: captionFor(platform, item.captions?.[platform] ?? brief?.captions[platform] ?? "", link),
        provider: a.provider,
      }))
  );
  const missing = item.platforms.filter((p) => !targets.some((t) => t.platform === p));
  if (!targets.length) {
    const names = item.platforms.map((p) => platformMeta(p).label).join(" or ");
    throw new AppError(`Connect ${names} in Settings → Connected accounts, then schedule again.`, "ACCOUNT_DISCONNECTED", false);
  }

  const publishAt = new Date(Math.max(new Date(item.slot_at).getTime(), Date.now() + MIN_LEAD_MS)).toISOString();
  const post = await createPost(db, { media_id: item.selected_media_id, status: "scheduled", publish_at: publishAt, origin: "agent", plan_item_id: itemId, targets });
  await updateItem(db, itemId, {
    status: "scheduled",
    error: missing.length ? `Not posted to ${missing.map((p) => platformMeta(p).label).join(", ")}: no account connected.` : null,
  });
  return { postId: post.id, publishAt, platforms: targets.map((t) => t.platform), missing };
}
