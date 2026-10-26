import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { assertOwnKey, currentBusiness } from "@/core/business";
import { businessKey } from "@/providers/storage/supabase-storage";
import { createClient } from "@/lib/supabase/server";
import { listMedia, createMedia, type Media } from "@/core/media";
import { AppError } from "@/core/errors";
import { UPLOAD_RULES } from "@/config/uploads";
import { inngest } from "@/jobs/client";
import type { MediaListItem } from "@/modules/library/types";
import { assertVideoReady } from "@/providers/ffmpeg/client";

/** Adds the product name and the slide count each card shows. */
async function withExtras(db: Awaited<ReturnType<typeof createClient>>, media: Media[]): Promise<MediaListItem[]> {
  const offeringIds = [...new Set(media.map((m) => m.offering_id).filter(Boolean))] as string[];
  const carouselIds = media.filter((m) => m.type === "carousel").map((m) => m.id);

  const [offerings, slides] = await Promise.all([
    offeringIds.length ? db.from("offerings").select("id, name").in("id", offeringIds) : Promise.resolve({ data: [] }),
    carouselIds.length ? db.from("media_files").select("media_id").eq("role", "slide").in("media_id", carouselIds) : Promise.resolve({ data: [] }),
  ]);

  const names = new Map((offerings.data ?? []).map((o: { id: string; name: string }) => [o.id, o.name]));
  const counts = new Map<string, number>();
  for (const s of (slides.data ?? []) as { media_id: string }[]) counts.set(s.media_id, (counts.get(s.media_id) ?? 0) + 1);

  return media.map((m) => ({
    ...m,
    product_name: (m.offering_id && names.get(m.offering_id)) || m.creative_spec?.product_name || null,
    slide_count: m.type === "carousel" ? (counts.get(m.id) ?? null) : null,
  }));
}

export const GET = apiHandler(async (req: NextRequest) => {
  const db = await createClient();
  const type = req.nextUrl.searchParams.get("type") as Media["type"] | null;
  const media = await listMedia(db, type || undefined);
  return NextResponse.json(await withExtras(db, media));
});

const UPLOAD_FOLDERS = [UPLOAD_RULES.photo.folder, UPLOAD_RULES.video.folder];

export const POST = apiHandler(async (req: NextRequest) => {
  const { db, businessId } = await currentBusiness();
  const body = await req.json();

  // A file the browser already put in storage: saved as ready, nothing to generate
  if (body.source === "uploaded") {
    const key = String(body.storage_key ?? "");
    if (!UPLOAD_FOLDERS.some((folder) => key.startsWith(businessKey(businessId, `${folder}/`)))) {
      throw new AppError("This upload couldn't be found. Please upload it again.", "INVALID_INPUT", false);
    }
    const media = await createMedia(db, {
      type: key.startsWith(businessKey(businessId, `${UPLOAD_RULES.video.folder}/`)) ? "video" : "image",
      source: "uploaded",
      status: "ready",
      storage_key: key,
      idea: body.idea || undefined,
      offering_id: body.offering_id || undefined,
    });
    return NextResponse.json(media, { status: 201 });
  }

  // Videos need our renderer; say so now instead of failing after paying for clips
  if (body.type === "video") await assertVideoReady();

  if (body.reference_image_key) assertOwnKey(businessId, String(body.reference_image_key));

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
    language: body.language,
    offering_id: body.offering_id || undefined,
    creative_spec: body.product_name ? { product_name: String(body.product_name).trim() } : undefined,
    reference_image_key: body.reference_image_key,
  });

  if (!isText) {
    const event = body.type === "video" ? "media/generate-video" : "media/generate-image";
    await inngest.send({ name: event, data: { businessId, mediaId: media.id }, id: media.id });
  }

  return NextResponse.json(media, { status: 201 });
});
