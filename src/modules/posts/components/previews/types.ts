export interface PreviewAccount {
  displayName: string;
  avatarUrl?: string;
}

export interface PlatformPreviewProps {
  platform: "facebook" | "instagram" | "linkedin" | "twitter" | "tiktok";
  account: PreviewAccount;
  caption: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | "text";
}
