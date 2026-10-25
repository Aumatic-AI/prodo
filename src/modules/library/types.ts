import type { Media } from "@/core/media";

/** A media row as the Media list returns it, with the extras the cards show. */
export interface MediaListItem extends Media {
  /** Name of the linked offering, or the typed "Other" product */
  product_name: string | null;
  /** Number of slides, for carousels */
  slide_count: number | null;
}

export interface MediaFile {
  role: "slide" | "rendition" | "thumbnail" | "voice" | "music" | "subtitles";
  position: number;
  aspect_ratio: string | null;
  storage_key: string;
}

/** One media row with its files (slides, renditions…), for the detail view. */
export interface MediaDetail extends Media {
  files: MediaFile[];
}
