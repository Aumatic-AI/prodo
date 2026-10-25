import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/core/errors";
import { isResourceKey } from "@/core/brand/resources";
import { removeResource, updateResource } from "@/core/brand/resource-store";

type Params = { params: Promise<{ resource: string; id: string }> };

async function read(params: Params["params"]) {
  const { resource, id } = await params;
  if (!isResourceKey(resource)) throw new AppError("Unknown brand list.", "INVALID_INPUT", false);
  return { key: resource, id };
}

// Edit (also restores an archived row with { active: true })
export const PATCH = apiHandler(async (req: NextRequest, { params }: Params) => {
  const { key, id } = await read(params);
  const db = await createClient();
  return NextResponse.json(await updateResource(db, key, id, await req.json()));
});

// Archive brand rows; delete the rest
export const DELETE = apiHandler(async (_req: NextRequest, { params }: Params) => {
  const { key, id } = await read(params);
  const db = await createClient();
  await removeResource(db, key, id);
  return NextResponse.json({ ok: true });
});
