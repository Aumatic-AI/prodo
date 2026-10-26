import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { startRegenerate } from "@/core/onboarding/research";
import { loadBibleOverview } from "@/core/brand/overview";
import { inngest } from "@/jobs/client";

const bodySchema = z.object({ note: z.string().trim().max(1000).optional() });

// Writes a new draft from the same research, following the client's note
export const POST = apiHandler(async (req: NextRequest) => {
  const { note } = bodySchema.parse(await req.json().catch(() => ({})));
  const { db, businessId } = await currentBusiness();
  const research = await startRegenerate(db);
  await inngest.send({ name: "brand/regenerate", data: { businessId, runId: research.id, note: note || null } });
  return NextResponse.json(await loadBibleOverview(db));
});
