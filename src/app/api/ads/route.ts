import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { assertOwnKey, currentBusiness } from "@/core/business";
import { brandFolder } from "@/providers/storage/paths";
import { referenceFromLink } from "@/core/brand/reference-link";
import { AppError } from "@/core/errors";
import { FORMATS, type Format } from "@/core/creative/brief";
import { loadContentRules } from "@/core/content/prefs";
import { isVideoStyle, stylesFor } from "@/core/content/styles";
import { hasTalkingFootage } from "@/core/brand/footage";
import type { SupabaseClient } from "@supabase/supabase-js";
import { approvedBible, getItemView, planForWeek } from "@/core/plans/plans";
import { weekClock } from "@/core/plans/week";
import { allowedFormats } from "@/agents/planner/slots";
import { safeZone, weekStartOf, zonedParts } from "@/lib/zoned-time";
import { inngest } from "@/jobs/client";
import { assertVideoReady } from "@/providers/ffmpeg/client";

const schema = z.object({
  format: z.enum(FORMATS),
  platforms: z.array(z.string()).min(1, "Pick at least one platform"),
  /** What the ad is about, in the client's words */
  /** Not needed when copying a reference video */
  idea: z.string().trim().max(10000).default(""),
  offeringId: z.string().uuid().nullish(),
  personaId: z.string().uuid().nullish(),
  /** When it should go out (ISO); default tomorrow at the same time */
  slotAt: z.string().datetime().nullish(),
  /** A content style (image or video style id); default the client's top pick for the format */
  style: z.string().nullish(),
  /** A video to make again with this product (a storage key the browser uploaded); everything else comes from it */
  referenceVideoKey: z.string().trim().min(1).nullish(),
  /** Or a link to it: a Meta Ad Library ad, an Instagram, TikTok or YouTube post, or a video file */
  referenceUrl: z.string().trim().min(5).max(2000).nullish(),
});

/**
 * The style for a one-off ad: the one asked for whenever it fits the format (the client picked it for
 * this ad, so it isn't limited to their onboarding picks), else their top pick. Auto-create (the
 * Planner) keeps to the onboarding picks.
 */
async function styleFor(db: SupabaseClient, format: Format, asked: string | null | undefined): Promise<string | null> {
  if (format === "text") return null;
  const rules = await loadContentRules(db);
  const talking = await hasTalkingFootage(db, rules.people);
  const options = stylesFor(format, { image: rules.imageStyles, video: rules.videoStyles }, rules.people, talking);
  // Videos: any video style; one that needs the client's talking footage becomes a voice-over explainer without it (videoPlan)
  if (format === "video") return asked && isVideoStyle(asked) ? asked : (options[0] ?? null);
  // Images: any style the format can take (none with people when the client wants none)
  const possible = stylesFor(format, { image: [], video: [] }, rules.people, talking) as string[];
  if (asked && possible.includes(asked)) return asked;
  return options[0] ?? null;
}

/**
 * A review ad needs a confirmed review and an offer ad a price to show; without them the only way
 * to make one is to invent it, so say so before anything is paid for.
 */
async function assertStyleHasFacts(db: SupabaseClient, style: string | null, offeringId: string | null): Promise<void> {
  if (style === "review") {
    const { count, error } = await db.from("proof_items").select("id", { count: "exact", head: true }).eq("verified", true);
    if (error) throw error;
    if (!count) throw new AppError("A review ad needs a confirmed customer review, and there isn't one yet. Add or confirm one in Brand → Proof, or pick another style.", "INVALID_INPUT", false);
  }
  if (style === "promo") {
    const { data, error } = offeringId ? await db.from("offerings").select("price").eq("id", offeringId).maybeSingle() : { data: null, error: null };
    if (error) throw error;
    if (data?.price == null) throw new AppError("An offer ad shows a price: pick a product that has one, or another style.", "INVALID_INPUT", false);
  }
}

// "Create ad for…": one slot through the full chain (Creative Director → QA → Producer → QA)
export const POST = apiHandler(async (req: NextRequest) => {
  const input = schema.parse(await req.json());
  const { db, businessId } = await currentBusiness();
  await approvedBible(db);
  if (!allowedFormats(input.platforms).includes(input.format)) {
    throw new AppError("That format doesn't work on every platform you picked (TikTok and YouTube take video only; text posts don't work on Instagram).", "INVALID_INPUT", false);
  }

  // Videos need our renderer; say so now instead of after paying for a brief
  if (input.format === "video") await assertVideoReady();

  const copying = !!(input.referenceVideoKey || input.referenceUrl);
  if (!copying && input.idea.length < 3) throw new AppError("Say what the ad is about.", "INVALID_INPUT", false);
  if (copying && !input.offeringId) throw new AppError("Pick the product for this video.", "INVALID_INPUT", false);
  // A copied video follows the reference, not a content style
  const style = copying ? null : await styleFor(db, input.format, input.style);
  await assertStyleHasFacts(db, style, input.offeringId ?? null);

  // A reference video: kept with the brand's references ("Video we like") and linked to this post
  let referenceVideoId: string | null = null;
  if (copying) {
    if (input.format !== "video") throw new AppError("A reference video is only for video posts.", "INVALID_INPUT", false);
    // A pasted link: the video is found, downloaded and kept in the brand's references first
    const referenceKey = input.referenceVideoKey ?? (await referenceFromLink(businessId, input.referenceUrl!));
    assertOwnKey(businessId, referenceKey);
    if (!referenceKey.startsWith(brandFolder(businessId, "references"))) throw new AppError("This reference video couldn't be found. Please upload it again.", "INVALID_INPUT", false);
    const { data: asset, error: assetError } = await db
      .from("brand_assets")
      .insert({ kind: "reference_video", storage_key: referenceKey, offering_id: input.offeringId ?? null })
      .select("id")
      .single();
    if (assetError) throw assetError;
    referenceVideoId = asset.id;
  }

  const clock = await weekClock(db);
  const slotAt = input.slotAt ? new Date(input.slotAt) : new Date(Date.now() + 24 * 3600_000);
  if (slotAt.getTime() < Date.now()) throw new AppError("Pick a time in the future.", "INVALID_INPUT", false);
  const plan = await planForWeek(db, weekStartOf(zonedParts(slotAt, safeZone(clock.timezone)).day));

  const { data: item, error } = await db
    .from("plan_items")
    .insert({
      plan_id: plan.id,
      slot_at: slotAt.toISOString(),
      platforms: input.platforms,
      format: input.format,
      style,
      offering_id: input.offeringId ?? null,
      persona_id: copying ? null : (input.personaId ?? null),
      angle: copying ? "The reference video, made again with this product" : input.idea,
      // What the ad should achieve. The Creative Director and QA read it, so it must never read like a
      // product fact ("Made on request" was printed on ads and judged as a promise)
      objective: input.offeringId ? "Sell this product" : "Make people want to discover the brand",
      funnel_stage: input.offeringId ? "bofu" : "tofu",
      rationale: "You asked for this ad.",
      status: "planned",
      ...(referenceVideoId ? { reference_video_id: referenceVideoId } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;

  await inngest.send({ name: "plan-item/produce", id: `produce-${item.id}`, data: { businessId, itemId: item.id, planId: plan.id, oneOff: true } });
  return NextResponse.json(await getItemView(db, item.id), { status: 201 });
});
