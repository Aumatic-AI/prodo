import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { AppError } from "@/core/errors";
import { approvedBible } from "@/core/plans/plans";
import { weekClock } from "@/core/plans/week";
import { addDays, weekStartOf } from "@/lib/zoned-time";
import { inngest } from "@/jobs/client";
import { assertVideoReady } from "@/providers/ffmpeg/client";

const MAX_BATCH = 10;

const kindCount = z.number().int().min(0).max(MAX_BATCH).default(0);
const schema = z
  .object({ static: kindCount, carousel: kindCount, video: kindCount, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid day").optional() })
  .refine((c) => c.static + c.carousel + c.video >= 1, "Pick at least 1 post")
  .refine((c) => c.static + c.carousel + c.video <= MAX_BATCH, `Up to ${MAX_BATCH} posts at a time`);

// "Auto-create": the Planner picks the products, people, angles, styles and times for a chosen number of
// images, carousels and videos (nothing to type), and every post is made like a single ad, ready to approve.
export const POST = apiHandler(async (req: NextRequest) => {
  const { date, ...counts } = schema.parse(await req.json());
  const count = counts.static + counts.carousel + counts.video;
  const { db, businessId } = await currentBusiness();
  await approvedBible(db);
  if (counts.video > 0) await assertVideoReady();

  const { data: profile, error } = await db.from("business_profile").select("posting_prefs").single();
  if (error) throw error;
  const platforms = Object.values((profile?.posting_prefs?.platforms ?? {}) as Record<string, number>);
  if (!platforms.some((n) => n > 0)) {
    throw new AppError("No platforms are set to post to. Set them in Settings → Automation, then try again.", "INVALID_INPUT", false);
  }

  // The first post is tomorrow: its week is the one the posts start in
  const clock = await weekClock(db);
  if (date && date <= clock.today) throw new AppError("Pick a day after today.", "INVALID_INPUT", false);
  const weekStart = weekStartOf(date ?? addDays(clock.today, 1));
  await inngest.send({
    name: "plan/requested",
    id: `batch-${businessId}-${counts.static}-${counts.carousel}-${counts.video}-${date ?? "next"}-${Math.floor(Date.now() / 10_000)}`,
    data: { businessId, weekStart, source: "client", batch: { ...counts, ...(date ? { date } : {}) } },
  });
  return NextResponse.json({ weekStart, started: true, count }, { status: 202 });
});
