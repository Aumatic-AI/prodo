import { AtSign, Facebook, Instagram, Linkedin, Music2, Twitter, Youtube, type LucideIcon } from "lucide-react";

export interface PlatformConfig {
  label: string;
  /** Brand colour, for small marks only (icons, dots), never for text on our UI */
  color: string;
  icon: LucideIcon;
  captionMaxLength: number;
  supportsImages: boolean;
  supportsVideos: boolean;
  /** Sizes the platform shows best, first = preferred */
  aspectRatios: ("1:1" | "4:5" | "9:16" | "16:9")[];
}

export const PLATFORMS: Record<string, PlatformConfig> = {
  instagram: {
    label: "Instagram",
    color: "#E1306C",
    icon: Instagram,
    captionMaxLength: 2200,
    supportsImages: true,
    supportsVideos: true,
    aspectRatios: ["4:5", "1:1", "9:16"],
  },
  facebook: {
    label: "Facebook",
    color: "#1877F2",
    icon: Facebook,
    captionMaxLength: 63206,
    supportsImages: true,
    supportsVideos: true,
    aspectRatios: ["4:5", "1:1", "9:16"],
  },
  linkedin: {
    label: "LinkedIn",
    color: "#0A66C2",
    icon: Linkedin,
    captionMaxLength: 3000,
    supportsImages: true,
    supportsVideos: true,
    aspectRatios: ["1:1", "4:5", "16:9"],
  },
  twitter: {
    label: "X",
    color: "#000000",
    icon: Twitter,
    captionMaxLength: 280,
    supportsImages: true,
    supportsVideos: true,
    aspectRatios: ["16:9", "1:1"],
  },
  tiktok: {
    label: "TikTok",
    color: "#000000",
    icon: Music2,
    captionMaxLength: 2200,
    supportsImages: false,
    supportsVideos: true,
    aspectRatios: ["9:16"],
  },
  youtube: {
    label: "YouTube",
    color: "#FF0000",
    icon: Youtube,
    captionMaxLength: 5000,
    supportsImages: false,
    supportsVideos: true,
    aspectRatios: ["9:16", "16:9"],
  },
};

const FALLBACK: PlatformConfig = {
  label: "",
  color: "#555b69",
  icon: AtSign,
  captionMaxLength: 2200,
  supportsImages: true,
  supportsVideos: true,
  aspectRatios: ["1:1"],
};

/** Config for a platform id ("x" is an alias of "twitter"). Unknown ids get a neutral fallback named after the id. */
export function platformMeta(platform: string): PlatformConfig {
  const id = platform === "x" ? "twitter" : platform;
  return PLATFORMS[id] ?? { ...FALLBACK, label: platform.charAt(0).toUpperCase() + platform.slice(1) };
}

export function formatCount(n?: number | null): string {
  if (n === undefined || n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en");
}
