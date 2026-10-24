import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { PLATFORMS } from "@/config/platforms";
import { publisherFor } from "@/providers/publishing/registry";

// Link where the client signs in to connect a social account
export const GET = apiHandler(async (req: NextRequest) => {
  const platform = req.nextUrl.searchParams.get("platform") ?? "";
  if (!PLATFORMS[platform]) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Pick a platform to connect." } }, { status: 400 });
  }
  const url = await publisherFor().getConnectUrl(platform);
  return NextResponse.json({ url });
});
