import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { getMedia } from "@/core/media";
import { getProfile } from "@/core/profile";
import { writeCaptions } from "@/core/captions";
import { urlFor } from "@/providers/storage/supabase-storage";

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await req.json();
  const platforms: string[] = Array.isArray(body.platforms) ? body.platforms : [];

  if (!platforms.length) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "platforms is required" } },
      { status: 400 }
    );
  }

  const db = await createClient();
  const media = await getMedia(db, id);
  const profile = await getProfile(db);

  const idea = media.idea || media.content || "";
  if (!idea) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "This media has no idea or content to base captions on" } },
      { status: 400 }
    );
  }

  const imageUrl =
    media.type === "image" && media.storage_key
      ? urlFor(process.env.NEXT_PUBLIC_SUPABASE_URL!, media.storage_key)
      : null;

  const captions = await writeCaptions({ idea, imageUrl, platforms, profile });
  return NextResponse.json({ captions });
});
