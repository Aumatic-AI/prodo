import { Badge } from "@/components/kit/Badge";
import { publicUrl } from "@/components/kit/MediaUploader";
import { cn } from "@/lib/utils";
import type { AdminBusiness } from "@/core/admin/businesses";

// Small pieces the admin screens share: money, dates, a business's mark and its status.

export const money = (usd: number | null | undefined, digits = 2) => (usd === null || usd === undefined ? "—" : `$${usd.toLocaleString("en", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`);

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dayTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const dateShort = (iso: string | null | undefined) => (iso ? day.format(new Date(iso)) : "—");
export const dateTime = (iso: string | null | undefined) => (iso ? dayTime.format(new Date(iso)) : "—");

/** "3 h ago", "5 days ago" */
export function ago(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return minutes <= 1 ? "Just now" : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 31 ? `${days} day${days === 1 ? "" : "s"} ago` : dateShort(iso);
}

export const businessName = (b: Pick<AdminBusiness, "name" | "email">) => b.name || b.email || "Unnamed business";

export function BusinessMark({ business, size = 36 }: { business: Pick<AdminBusiness, "name" | "email" | "logoKey">; size?: number }) {
  const initial = businessName(business).trim().charAt(0).toUpperCase();
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-ob border border-ob-line bg-ob-sunken text-sm font-bold text-ob-ink-soft" style={{ width: size, height: size }}>
      {business.logoKey ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={publicUrl(business.logoKey)} alt="" className="size-full object-contain p-1" />
      ) : (
        initial
      )}
    </span>
  );
}

/** Setting up / Active / Paused, and a fee waiting */
export function StatusBadge({ business, className }: { business: Pick<AdminBusiness, "onboardingStatus" | "paused" | "feesDue">; className?: string }) {
  if (business.feesDue)
    return (
      <Badge tone="danger" size="sm" className={className}>
        Fee due
      </Badge>
    );
  if (business.onboardingStatus !== "done")
    return (
      <Badge tone="neutral" size="sm" className={className}>
        Setting up
      </Badge>
    );
  if (business.paused)
    return (
      <Badge tone="warn" size="sm" className={className}>
        Paused
      </Badge>
    );
  return (
    <Badge tone="success" size="sm" className={cn(className)}>
      Active
    </Badge>
  );
}

/** A random password the admin can hand over (no look-alike characters) */
export function newPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => chars[n % chars.length]).join("");
}
