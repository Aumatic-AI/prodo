import { FileText, GalleryHorizontalEnd, Image as ImageIcon, Video, type LucideIcon } from "lucide-react";
import type { MediaStatus, MediaType } from "@/core/media";

export const TYPE_META: Record<MediaType, { label: string; plural: string; icon: LucideIcon; making: string }> = {
  image: { label: "Image", plural: "Images", icon: ImageIcon, making: "Making your image…" },
  video: { label: "Video", plural: "Videos", icon: Video, making: "Making your video…" },
  carousel: { label: "Carousel", plural: "Carousels", icon: GalleryHorizontalEnd, making: "Making your carousel…" },
  text: { label: "Text", plural: "Text", icon: FileText, making: "Saving…" },
};

export const STATUS_META: Record<MediaStatus, { label: string; tone: "success" | "primary" | "danger" }> = {
  ready: { label: "Ready", tone: "success" },
  generating: { label: "Generating", tone: "primary" },
  failed: { label: "Failed", tone: "danger" },
};

/** Tailwind aspect class for a stored ratio like "4:5". */
export function aspectClass(ratio: string | null | undefined): string {
  switch (ratio) {
    case "9:16":
      return "aspect-[9/16]";
    case "16:9":
      return "aspect-video";
    case "4:5":
      return "aspect-[4/5]";
    default:
      return "aspect-square";
  }
}

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** "Just now", "5 min ago", "3 h ago", "Yesterday", then a date. */
export function relativeDate(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h ago`;
  if (hours < 48) return "Yesterday";
  return dateFormat.format(new Date(iso));
}

export function fullDate(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** Seconds as "0:42" or "3:05". */
export function elapsed(fromIso: string, now: number): string {
  const sec = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function money(usd: number | null | undefined): string {
  if (!usd) return "$0.00";
  return usd < 0.01 ? "< $0.01" : `$${usd.toFixed(2)}`;
}
