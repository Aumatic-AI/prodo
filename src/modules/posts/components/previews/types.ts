export interface PreviewAccount {
  displayName: string;
  avatarUrl?: string;
}

export type PreviewMediaType = "image" | "video" | "text" | "carousel";

export interface PlatformPreviewProps {
  platform: string;
  account: PreviewAccount;
  caption: string;
  /** One URL, or every slide of a carousel in order */
  mediaUrls: string[];
  mediaType?: PreviewMediaType;
}
