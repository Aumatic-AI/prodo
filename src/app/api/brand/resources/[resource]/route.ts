import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/core/errors";
import { isResourceKey } from "@/core/brand/resources";
import { createResource, listResource } from "@/core/brand/resource-store";

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
  const db = await createClient();
  return NextResponse.json(await createResource(db, key, await req.json()), { status: 201 });
});
