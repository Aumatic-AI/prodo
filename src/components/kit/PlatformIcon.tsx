import { AtSign, Facebook, Instagram, Linkedin, Music2, Twitter, Youtube } from "lucide-react";

const ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
  linkedin: Linkedin,
  tiktok: Music2,
  twitter: Twitter,
};

export function PlatformIcon({ platform }: { platform: string }) {
  const Icon = ICONS[platform] ?? AtSign;
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-ob border border-ob-line bg-ob-sunken text-ob-ink-soft" aria-hidden="true">
      <Icon size={18} />
    </span>
  );
}
