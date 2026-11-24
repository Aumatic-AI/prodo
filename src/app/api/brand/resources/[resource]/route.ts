import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/core/errors";
import { isResourceKey } from "@/core/brand/resources";
import { createResource, listResource } from "@/core/brand/resource-store";
import { currentBusiness } from "@/core/business";
import { inngest } from "@/jobs/client";
import { assertCredits, spendCredits } from "@/core/credits/ledger";
import { priceOf } from "@/core/credits/prices";

/** The client's own video (not a reference to copy): Prodo watches it for usable moments, which costs credits */
const isOwnVideo = (asset: { kind?: string; storage_key?: string }) => asset.kind !== "reference_video" && /.(mp4|mov)$/i.test(asset.storage_key ?? "");

async function resourceOf(params: Promise<{ resource: string }>) {
  const { resource } = await params;
  if (!isResourceKey(resource)) throw new AppError("Unknown brand list.", "INVALID_INPUT", false);
  return resource;
}

// One Brand Hub list (?archived=1 includes archived rows)
export const GET = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ resource: string }> }) => {
  const key = await resourceOf(params);
  const db = await createClient();
  return NextResponse.json(await listResource(db, key, { archived: req.nextUrl.searchParams.get("archived") === "1" }));
});

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ resource: string }> }) => {
  const key = await resourceOf(params);
  const { db, businessId } = await currentBusiness();
  const body = await req.json();
  const video = key === "assets" && isOwnVideo(body ?? {});
  if (video) await assertCredits(businessId, await priceOf("brand_video"), "Adding a video");
  const row = await createResource(db, key, body);
  // The client's own video: watch it now so the next ads can use it
  const asset = row as { id?: string; kind?: string; storage_key?: string };
  if (key === "assets" && isOwnVideo(asset)) {
    await spendCredits(businessId, { action: "brand_video", label: "Video added to brand assets", refId: asset.id ?? null, key: `footage:${asset.id}` }, "Adding a video");
    await inngest.send({ name: "brand/footage-added", data: { businessId } }).catch(() => undefined);
  }
  return NextResponse.json(row, { status: 201 });
});
