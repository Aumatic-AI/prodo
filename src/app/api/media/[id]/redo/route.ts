import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { AppError } from "@/core/errors";
import { getMedia, startGenerating, type Media } from "@/core/media";
import { assertVideoReady } from "@/providers/ffmpeg/client";

const schema = z.object({ note: z.string().trim().min(2, "Say what should change").max(500) });

// "Make again with a note": a new media item with the same inputs plus the client's change.
// The original stays in the library; the new one points back to it (variant_of).
export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { note } = schema.parse(await req.json());
  const { db, businessId } = await currentBusiness();
  const original = await getMedia(db, id);

  if (original.source !== "generated") throw new AppError("Only media Prodo made can be made again. Upload a new file instead.", "INVALID_INPUT", false);
  if (original.type === "text") throw new AppError("Text posts can't be made again. Edit the text in a post instead.", "INVALID_INPUT", false);
  if (original.plan_item_id) throw new AppError("This came from the weekly plan. Use Make again on This week instead.", "INVALID_INPUT", false);
  if (original.type === "video") await assertVideoReady();

  const { data, error } = await db
    .from("media")
    .insert({
      type: original.type,
      source: "generated",
      status: "generating",
      idea: `${original.idea ?? ""}\n\nChange: ${note}`.trim(),
      aspect_ratio: original.aspect_ratio,
      use_logo: original.use_logo,
      duration_sec: original.duration_sec,
      voice_id: original.voice_id,
      voice_name: original.voice_name,
      audio_style: original.audio_style,
      character: original.character,
      language: original.language,
      offering_id: original.offering_id,
      reference_image_key: original.reference_image_key,
      creative_spec: { ...(original.creative_spec ?? {}), note },
      variant_of: original.id,
    })
    .select()
    .single();
  if (error) throw error;
  const media = data as Media;

  await startGenerating(db, businessId, media, media.id);
  return NextResponse.json(media, { status: 201 });
});
