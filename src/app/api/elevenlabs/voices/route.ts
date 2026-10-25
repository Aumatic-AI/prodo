import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { ai } from "@/providers/ai/registry";

const text = z.string().trim().max(100).optional();

// Only the filters ElevenLabs' voice library accepts
const querySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  page_size: z.coerce.number().int().min(1).max(100).default(24),
  search: text,
  language: text,
  accent: text,
  gender: text,
  age: text,
  category: z.enum(["professional", "famous", "high_quality"]).optional(),
  use_cases: z.array(z.string().max(60)).max(10).optional(),
  featured: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  sort: z.enum(["created_date", "usage_character_count_1y", "trending", "cloned_by_count"]).optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const params = Object.fromEntries(sp.entries());
  const useCases = sp.getAll("use_cases");
  const filters = querySchema.parse({ ...params, use_cases: useCases.length ? useCases : undefined });
  return NextResponse.json(await ai.voices(filters));
});
