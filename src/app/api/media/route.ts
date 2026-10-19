import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { listMedia, createMedia } from "@/core/media";
import { inngest } from "@/jobs/client";

export const GET = apiHandler(async (req: NextRequest) => {
  const db = await createClient();
  const type = req.nextUrl.searchParams.get("type") as "image" | "video" | "text" | undefined;
  const media = await listMedia(db, type || undefined);
  return NextResponse.json(media);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const db = await createClient();
  const body = await req.json();

  const isText = body.type === "text";

  const media = await createMedia(db, {
    type: body.type,
    source: "generated",
    status: isText ? "ready" : "generating",
    idea: body.idea,
    content: body.content,
    aspect_ratio: body.aspect_ratio,
    use_logo: body.use_logo,
    duration_sec: body.duration_sec,
    voice_id: body.voice_id,
    voice_name: body.voice_name,
    audio_style: body.audio_style,
    character: body.character,
    video_type: body.video_type,
    language: body.language,
    product: body.product,
    reference_image_key: body.reference_image_key,
  });

  if (!isText) {
    const event = body.type === "video" ? "media/generate-video" : "media/generate-image";
    await inngest.send({ name: event, data: { mediaId: media.id }, id: media.id });
  }

  return NextResponse.json(media, { status: 201 });
});
