import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { deleteMedia, getMedia } from "@/core/media";
import { inngest } from "@/jobs/client";
import type { MediaDetail } from "@/modules/library/types";

const ROLE_ORDER = ["slide", "rendition", "thumbnail", "voice", "music", "subtitles"];

/** The media row plus its files (slides, renditions…), ordered by role then position. */
export const GET = apiHandler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const db = await createClient();
  const [media, files] = await Promise.all([
    getMedia(db, id),
    db.from("media_files").select("role, position, aspect_ratio, storage_key").eq("media_id", id).order("position"),
  ]);
  if (files.error) throw files.error;

  const sorted = [...(files.data ?? [])].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.position - b.position);
  return NextResponse.json({ ...media, files: sorted } as MediaDetail);
});

export const DELETE = apiHandler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const db = await createClient();
  await deleteMedia(db, id);
  await inngest.send({ name: "media/deleted", data: { mediaId: id } });
  return NextResponse.json({ ok: true });
});
