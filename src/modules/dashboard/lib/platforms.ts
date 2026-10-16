import { Facebook, Instagram, Youtube, Twitter, Linkedin } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface PlatformMeta {
  platform: string;
  label: string;
  color: string;
  icon: LucideIcon;
}

const PLATFORMS: PlatformMeta[] = [
  { platform: "facebook", label: "Facebook", color: "#1877F2", icon: Facebook },
  { platform: "instagram", label: "Instagram", color: "#E1306C", icon: Instagram },
  { platform: "youtube", label: "YouTube", color: "#FF0000", icon: Youtube },
  { platform: "twitter", label: "X (Twitter)", color: "#000000", icon: Twitter },
  { platform: "x", label: "X (Twitter)", color: "#000000", icon: Twitter },
  { platform: "linkedin", label: "LinkedIn", color: "#0A66C2", icon: Linkedin },
  { platform: "tiktok", label: "TikTok", color: "#000000", icon: Twitter },
];

export function platformMeta(platform: string): PlatformMeta | undefined {
  return PLATFORMS.find((p) => p.platform === platform);
}

export function formatCount(n?: number | null): string {
  if (n === undefined || n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
