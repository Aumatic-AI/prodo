import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { AppError } from "@/core/errors";
import { FORMATS, type Format } from "@/core/creative/brief";
import { loadContentRules } from "@/core/content/prefs";
import { stylesFor } from "@/core/content/styles";
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
  idea: z.string().trim().min(3, "Say what the ad is about").max(300),
  offeringId: z.string().uuid().nullish(),
  personaId: z.string().uuid().nullish(),
  /** When it should go out (ISO); default tomorrow at the same time */
  slotAt: z.string().datetime().nullish(),
  /** A content style (image or video style id); default the client's top pick for the format */
  style: z.string().nullish(),
});

/** The style for a one-off ad: the one asked for when it fits the format, else the client's top pick. */
async function styleFor(db: SupabaseClient, format: Format, asked: string | null | undefined): Promise<string | null> {
  if (format === "text") return null;
  const rules = await loadContentRules(db);
  const options = stylesFor(format, { image: rules.imageStyles, video: rules.videoStyles }, rules.people, await hasTalkingFootage(db, rules.people));
  return asked && (options as string[]).includes(asked) ? asked : (options[0] ?? null);
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
      style: await styleFor(db, input.format, input.style),
      offering_id: input.offeringId ?? null,
      persona_id: input.personaId ?? null,
      angle: input.idea,
      objective: "Made on request",
      funnel_stage: input.offeringId ? "bofu" : "tofu",
      rationale: "You asked for this ad.",
      status: "planned",
    })
    .select("id")
    .single();
  if (error) throw error;

  await inngest.send({ name: "plan-item/produce", id: `produce-${item.id}`, data: { businessId, itemId: item.id, planId: plan.id, oneOff: true } });
  return NextResponse.json(await getItemView(db, item.id), { status: 201 });
});
