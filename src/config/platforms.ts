export interface PlatformConfig {
  label: string;
  captionMaxLength: number;
  supportsImages: boolean;
  supportsVideos: boolean;
}

export const PLATFORMS: Record<string, PlatformConfig> = {
  instagram: {
    label: "Instagram",
    captionMaxLength: 2200,
    supportsImages: true,
    supportsVideos: true,
  },
  facebook: {
    label: "Facebook",
    captionMaxLength: 63206,
    supportsImages: true,
    supportsVideos: true,
  },
  linkedin: {
    label: "LinkedIn",
    captionMaxLength: 3000,
    supportsImages: true,
    supportsVideos: true,
  },
  twitter: {
    label: "X (Twitter)",
    captionMaxLength: 280,
    supportsImages: true,
    supportsVideos: true,
  },
  tiktok: {
    label: "TikTok",
    captionMaxLength: 2200,
    supportsImages: false,
    supportsVideos: true,
  },
};
