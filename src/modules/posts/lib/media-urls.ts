import { publicUrl } from "@/components/kit/MediaUploader";
import type { PreviewMediaType } from "../components/previews";
import type { PostMedia } from "../hooks/usePosts";

/** Public URLs to show for a media item: every slide of a carousel in order, else its one file. */
export function mediaUrls(media: PostMedia | null | undefined): string[] {
  if (!media) return [];
  const slides = (media.files ?? []).filter((f) => f.role === "slide").sort((a, b) => a.position - b.position);
  if (media.type === "carousel" && slides.length) return slides.map((s) => publicUrl(s.storage_key));
  return media.storage_key ? [publicUrl(media.storage_key)] : [];
}

export function previewType(media: PostMedia | null | undefined): PreviewMediaType {
  return media?.type ?? "image";
}
