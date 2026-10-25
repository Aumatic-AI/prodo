import { platformMeta } from "@/config/platforms";
import { cn } from "@/lib/utils";

/** Platform icons in their brand colour, deduplicated. */
export function PlatformIcons({ platforms, size = 12, className }: { platforms: string[]; size?: number; className?: string }) {
  const unique = [...new Set(platforms)];
  return (
    <span className={cn("flex items-center gap-1", className)}>
      {unique.map((p) => {
        const meta = platformMeta(p);
        const Icon = meta.icon;
        return (
          <span key={p} title={meta.label} className="inline-flex">
            <Icon size={size} style={{ color: meta.color }} aria-label={meta.label} />
          </span>
        );
      })}
    </span>
  );
}
