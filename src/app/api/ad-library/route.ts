import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { libraryPage, libraryStart } from "@/core/ad-library";

const schema = z.object({
  /** A brand name or words in the ads */
  q: z.string().trim().max(100).optional(),
  country: z.string().trim().toUpperCase().max(3).default("ALL"),
  page: z.coerce.number().int().min(1).max(20).default(1),
});

// GET /api/ad-library: with no q, what the screen starts with (the business's country, searches left today);
// with q, a page of active Meta video ads (kept 48 hours, 1 credit when it isn't)
export const GET = apiHandler(async (req: NextRequest) => {
  const input = schema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const { db, businessId } = await currentBusiness();
  if (!input.q) return NextResponse.json(await libraryStart(db));
  return NextResponse.json(await libraryPage(db, businessId, { query: input.q, country: input.country, page: input.page }));
});
